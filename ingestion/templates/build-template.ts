/**
 * Genera las plantillas de carga manual del Product Owner:
 *   - convocatorias.xlsx (recomendada): encabezado fijo, listas desplegables, notas por columna e instrucciones.
 *   - convocatorias.csv (alternativa): separada por comas, con BOM UTF-8.
 * Las dos salen de las mismas columnas y filas de ejemplo, para que no se desalineen.
 *
 *   npm run template:xlsx
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { OPPORTUNITY_TYPE_LABELS } from "@/lib/catalog/labels";
import { MUNICIPALITIES } from "@/lib/catalog/geo";
import { REQUIRED_COLUMNS, TABULAR_COLUMNS, type TabularColumn } from "../adapters/tabular";

const XLSX_PATH = fileURLToPath(new URL("./convocatorias.xlsx", import.meta.url));
const CSV_PATH = fileURLToPath(new URL("./convocatorias.csv", import.meta.url));

const LAST_DATA_ROW = 300;
const FOREST = "FF204C3C";
const WHITE = "FFFFFFFF";
const EXAMPLE_GRAY = "FF6B7280";
const BORDER_GRAY = "FFD1D5DB";
const ZEBRA = "FFF3F6F4";
const FONT = "Calibri";

interface ColumnGuide {
  width: number;
  /** Qué poner. */
  what: string;
  examples: string;
}

/** Mismo contenido que la tabla de LEEME.md. */
const GUIDE: Record<TabularColumn, ColumnGuide> = {
  titulo: { width: 42, what: "Nombre del cargo o de la práctica.", examples: "Practicante de Mercadeo" },
  organizacion: { width: 30, what: "Empresa o entidad que ofrece la práctica.", examples: "Alcaldía de Medellín" },
  tipo: {
    width: 22,
    what: "Tipo de oportunidad. Elige de la lista o escríbelo como lo nombra la fuente.",
    examples: "Práctica profesional · Práctica empresarial · Pasantía · Contrato de aprendizaje · Judicatura",
  },
  nivel: {
    width: 22,
    what: "Nivel de formación que piden. Si son varios, escríbelos separados por coma.",
    examples: "Universitario · Tecnólogo · Técnico profesional · Técnico laboral · Posgrado",
  },
  municipio: { width: 18, what: "Dónde se hace la práctica.", examples: "Medellín · Itagüí · Envigado · Remoto" },
  modalidad: {
    width: 16,
    what: "Forma de trabajo. Si la convocatoria no lo dice, elige «Desconocida» o deja la celda vacía: no se asume presencial.",
    examples: "Presencial · Híbrida · Remota · Desconocida",
  },
  pago: {
    width: 22,
    what: "Cuánto pagan al mes o qué tipo de pago es.",
    examples: "$1.750.000 · Apoyo de sostenimiento · 1 SMMLV · No remunerada",
  },
  duracion: { width: 16, what: "Cuánto dura.", examples: "6 meses · 4 a 6 meses · un semestre" },
  fecha_limite: {
    width: 22,
    what: "Último día para postularse. Si no la publican, deja la celda vacía.",
    examples: "30 de noviembre de 2026 · 30/11/2026 (día/mes/año) · Hasta agotar cupos",
  },
  fecha_inicio: { width: 20, what: "Cuándo empieza (opcional).", examples: "1 de febrero de 2027 · enero 2027" },
  descripcion: {
    width: 60,
    what: "Resumen tuyo de 2 o 3 frases. No copies el texto completo de la fuente.",
    examples: "Apoyo al equipo de mercadeo digital en campañas y análisis de métricas.",
  },
  programas: {
    width: 40,
    what: "Carreras que piden. Escribe «y afines» si la convocatoria lo dice.",
    examples: "Mercadeo, Administración y afines · Cualquier carrera",
  },
  semestre: {
    width: 22,
    what: "Semestre mínimo o rango.",
    examples: "A partir de 7° semestre · Entre 6 y 9 semestre · Egresados",
  },
  requisitos: {
    width: 40,
    what: "Otros requisitos, separados por punto y coma (;).",
    examples: "Inglés B1; Excel intermedio",
  },
  instituciones: {
    width: 22,
    what: "Solo si la convocatoria es exclusiva de ciertas instituciones. Si no, deja la celda vacía.",
    examples: "UdeA, EAFIT",
  },
  enlace_postulacion: {
    width: 45,
    what: "Enlace oficial donde el estudiante se postula.",
    examples: "https://…",
  },
  enlace_fuente: {
    width: 45,
    what: "Página donde encontraste la convocatoria (puede ser el mismo enlace de postulación).",
    examples: "https://…",
  },
};

const EXAMPLES: Record<TabularColumn, string>[] = [
  {
    titulo: "EJEMPLO (borrar) - Practicante de Ingeniería Industrial",
    organizacion: "Empresa Ficticia Uno S.A.S.",
    tipo: "Práctica profesional",
    nivel: "Universitario",
    municipio: "Medellín, Antioquia",
    modalidad: "Híbrida",
    pago: "Apoyo de sostenimiento $1.750.000",
    duracion: "6 meses",
    fecha_limite: "15 de diciembre de 2027",
    fecha_inicio: "1 de febrero de 2028",
    descripcion:
      "Resumen propio de 2 o 3 frases: qué hará la persona y en qué área. No copies la descripción completa de la fuente.",
    programas: "Ingeniería Industrial, Ingeniería de Producción y afines",
    semestre: "A partir de 8° semestre",
    requisitos: "Manejo intermedio de Excel; Disponibilidad de tiempo completo",
    instituciones: "",
    enlace_postulacion: "https://example.com/postular/ejemplo-1",
    enlace_fuente: "https://example.com/convocatorias/ejemplo-1",
  },
  {
    titulo: "EJEMPLO (borrar) - Aprendiz de Desarrollo de Software",
    organizacion: "Organización Ficticia Dos",
    tipo: "Contrato de aprendizaje",
    nivel: "Tecnólogo",
    municipio: "Envigado",
    modalidad: "Presencial",
    pago: "Apoyo de sostenimiento",
    duracion: "6 meses",
    fecha_limite: "Hasta agotar cupos",
    fecha_inicio: "",
    descripcion: "Otro resumen propio y corto. Las columnas vacías se dejan en blanco.",
    programas: "Tecnología en Desarrollo de Software",
    semestre: "",
    requisitos: "Estar en etapa productiva",
    instituciones: "SENA, ITM",
    enlace_postulacion: "https://example.com/postular/ejemplo-2",
    enlace_fuente: "https://example.com/convocatorias/ejemplo-2",
  },
];

const LEVEL_OPTIONS = ["Universitario", "Tecnólogo", "Técnico profesional", "Técnico laboral", "Posgrado"];

interface ListRule {
  options: readonly string[];
  /** `strict`: avisa (sin bloquear) si el valor no está en la lista. `suggestion`: solo ofrece la lista. */
  mode: "strict" | "suggestion";
  prompt: string;
}

const LISTS: Partial<Record<TabularColumn, ListRule>> = {
  tipo: {
    options: Object.values(OPPORTUNITY_TYPE_LABELS),
    mode: "strict",
    prompt: "Elige de la lista. Si la fuente usa otro nombre, puedes escribirlo.",
  },
  modalidad: {
    // «Desconocida» (o la celda vacía) queda como `no_especificada`: ver normalize/modality.ts.
    options: ["Presencial", "Híbrida", "Remota", "Desconocida"],
    mode: "strict",
    prompt: "Elige de la lista. Si la convocatoria no lo dice, elige «Desconocida».",
  },
  nivel: {
    options: LEVEL_OPTIONS,
    mode: "suggestion",
    prompt: "Elige de la lista o escribe varios separados por coma (Universitario, Tecnólogo).",
  },
  municipio: {
    options: [...MUNICIPALITIES.map((m) => m.name), "Remoto"],
    mode: "suggestion",
    prompt: "Elige de la lista o escribe el municipio tal como aparece en la convocatoria.",
  },
};

const STEPS = [
  "Ve a la hoja «Convocatorias» (la pestaña de abajo). Cada fila es una convocatoria y cada columna un dato.",
  "Borra las 2 filas grises que empiezan por «EJEMPLO (borrar)» antes de cargar las reales.",
  "Escribe los datos como aparecen en la página de la convocatoria. El sistema entiende formatos variados: «$1.750.000», «1,5 millones», «15 de diciembre», «a partir de 8vo semestre»…",
  "Si un dato no aparece en la convocatoria, deja la celda vacía. No lo inventes.",
  "En «tipo», «nivel», «municipio» y «modalidad» puedes elegir de una lista desplegable (la flecha a la derecha de la celda) o escribir el texto.",
  "Pasa el cursor por el título de cada columna para ver una nota con qué va ahí y ejemplos.",
  "No cambies los nombres de la fila 1 ni el nombre de la hoja «Convocatorias». Sí puedes ordenar, filtrar y ensanchar columnas.",
  "Guarda normal (Ctrl + G o Archivo → Guardar), como libro de Excel (.xlsx). No hace falta convertirlo a CSV.",
  "Para revisar el archivo, en la terminal y desde la carpeta del proyecto: npm run ingest -- --xlsx ruta\\a\\tu-archivo.xlsx --dry-run",
];

const columnLetter = (index: number) => String.fromCharCode("A".charCodeAt(0) + index);
const thinBorder = { style: "thin" as const, color: { argb: BORDER_GRAY } };

function buildDataSheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet("Convocatorias", {
    views: [{ state: "frozen", ySplit: 1, topLeftCell: "A2", activeCell: "A2" }],
  });
  const lastColumn = columnLetter(TABULAR_COLUMNS.length - 1);

  sheet.columns = TABULAR_COLUMNS.map((key) => ({
    key,
    width: GUIDE[key].width,
    // Formato de texto: lo que se escribe queda tal cual (Excel no convierte fechas ni montos según la región).
    style: { numFmt: "@", alignment: { wrapText: true, vertical: "top" }, font: { name: FONT, size: 11 } },
  }));

  const header = sheet.getRow(1);
  header.height = 30;
  TABULAR_COLUMNS.forEach((key, i) => {
    const cell = header.getCell(i + 1);
    const guide = GUIDE[key];
    cell.value = key;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOREST } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = { right: { style: "thin", color: { argb: WHITE } } };
    const required = REQUIRED_COLUMNS.includes(key) ? " (obligatoria)" : "";
    cell.note = {
      texts: [
        { font: { bold: true, size: 9, name: "Tahoma" }, text: `${key}${required}\n` },
        { font: { size: 9, name: "Tahoma" }, text: `${guide.what}\nEjemplos: ${guide.examples}` },
      ],
    };
  });
  sheet.autoFilter = `A1:${lastColumn}1`;

  // Rango de datos: ajuste de texto, alineación arriba y formato de texto en cada celda.
  for (let rowNumber = 2; rowNumber <= LAST_DATA_ROW; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    TABULAR_COLUMNS.forEach((key, i) => {
      const cell = row.getCell(i + 1);
      cell.numFmt = "@";
      cell.alignment = { wrapText: true, vertical: "top" };
      const list = LISTS[key];
      if (!list) return;
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${list.options.join(",")}"`],
        showInputMessage: true,
        promptTitle: key,
        prompt: list.prompt,
        ...(list.mode === "strict"
          ? {
              // Aviso que deja continuar: nunca bloquea lo que la persona escribe.
              showErrorMessage: true,
              errorStyle: "warning",
              errorTitle: "Valor fuera de la lista",
              error: "Ese valor no está en la lista. Si así lo nombra la convocatoria, puedes dejarlo.",
            }
          : { showErrorMessage: false, errorStyle: "information" }),
      };
    });
  }

  EXAMPLES.forEach((example, index) => {
    const row = sheet.getRow(index + 2);
    TABULAR_COLUMNS.forEach((key, i) => {
      const cell = row.getCell(i + 1);
      const value = example[key];
      const isLink = /^https?:\/\//.test(value);
      if (value !== "") cell.value = isLink ? { text: value, hyperlink: value } : value;
      cell.font = { name: FONT, size: 11, italic: true, color: { argb: EXAMPLE_GRAY }, underline: isLink };
    });
  });
}

function buildInstructionsSheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet("Instrucciones", { views: [{ showGridLines: false }] });
  sheet.columns = [{ width: 24 }, { width: 62 }, { width: 72 }];
  const wrap = { wrapText: true, vertical: "top" as const };
  let rowNumber = 1;

  const fullWidth = (text: string, font: Partial<ExcelJS.Font>, height?: number) => {
    sheet.mergeCells(rowNumber, 1, rowNumber, 3);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = text;
    cell.font = { name: FONT, size: 11, ...font };
    cell.alignment = wrap;
    if (height) sheet.getRow(rowNumber).height = height;
    rowNumber += 1;
  };
  /** Las filas con celdas combinadas no se autoajustan en Excel: se calcula el alto según el largo. */
  const heightFor = (text: string, charsPerLine: number) => Math.max(1, Math.ceil(text.length / charsPerLine)) * 15 + 3;

  fullWidth("Cómo llenar la plantilla de convocatorias", { size: 16, bold: true, color: { argb: FOREST } }, 26);
  fullWidth(
    "PrácticasCol · Carga manual. Una fila por convocatoria; los datos se escriben como aparecen en la fuente.",
    { color: { argb: EXAMPLE_GRAY } },
    18,
  );
  rowNumber += 1;

  fullWidth("Pasos", { size: 13, bold: true, color: { argb: FOREST } }, 20);
  STEPS.forEach((step, i) => {
    const text = `${i + 1}. ${step}`;
    fullWidth(text, {}, heightFor(text, 150));
  });
  rowNumber += 1;

  fullWidth("Columnas", { size: 13, bold: true, color: { argb: FOREST } }, 20);
  const headerRow = sheet.getRow(rowNumber);
  ["Columna", "Qué poner", "Ejemplos"].forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOREST } };
    cell.alignment = { vertical: "middle" };
  });
  headerRow.height = 22;
  rowNumber += 1;

  TABULAR_COLUMNS.forEach((key, index) => {
    const guide = GUIDE[key];
    const required = REQUIRED_COLUMNS.includes(key) ? " *" : "";
    const row = sheet.getRow(rowNumber);
    [`${key}${required}`, guide.what, guide.examples].forEach((text, i) => {
      const cell = row.getCell(i + 1);
      cell.value = text;
      cell.font = { name: FONT, size: 11, bold: i === 0 };
      cell.alignment = wrap;
      cell.border = { bottom: thinBorder };
      if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    });
    row.height = Math.max(heightFor(guide.what, 60), heightFor(guide.examples, 70), 20);
    rowNumber += 1;
  });
  rowNumber += 1;

  fullWidth("* Columnas obligatorias. Las demás pueden quedar vacías si la convocatoria no trae el dato.", {
    italic: true,
    color: { argb: EXAMPLE_GRAY },
  });
  fullWidth(
    "Una práctica nunca debe cobrarle al estudiante: si una convocatoria pide dinero, no la cargues.",
    { italic: true, color: { argb: EXAMPLE_GRAY } },
  );
}

async function buildWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PrácticasCol";
  // Fechas fijas para que regenerar la plantilla no cambie el archivo sin motivo.
  workbook.created = new Date(Date.UTC(2026, 10, 14));
  workbook.modified = new Date(Date.UTC(2026, 10, 14));
  buildDataSheet(workbook);
  buildInstructionsSheet(workbook);
  // «Convocatorias» es la hoja activa al abrir.
  workbook.views = [{ x: 0, y: 0, width: 24000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  return workbook;
}

const csvCell = (value: string) => (/[",;\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Coma como separador y BOM UTF-8: abre bien en Excel configurado con coma y en Google Sheets. */
function buildCsv(): string {
  const rows = [[...TABULAR_COLUMNS], ...EXAMPLES.map((example) => TABULAR_COLUMNS.map((key) => example[key]))];
  return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

async function main(): Promise<void> {
  const workbook = await buildWorkbook();
  await workbook.xlsx.writeFile(XLSX_PATH);
  await writeFile(CSV_PATH, buildCsv(), "utf8");
  console.log(`Plantillas generadas:\n  ${XLSX_PATH}\n  ${CSV_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

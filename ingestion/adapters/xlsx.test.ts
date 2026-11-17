import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { PoliteFetcher } from "../http";
import { normalizeDraft } from "../normalize";
import type { AdapterContext } from "../types";
import { createCsvAdapter, CSV_COLUMNS } from "./csv";
import { cellToText, createXlsxAdapter, readXlsxRecords } from "./xlsx";

const templatePath = (name: string) => fileURLToPath(new URL(`../templates/${name}`, import.meta.url));

const http: PoliteFetcher = {
  get: async () => {
    throw new Error("El adaptador de Excel no debe usar la red");
  },
  isAllowed: async () => false,
};
const ctx: AdapterContext = {
  http,
  now: new Date("2026-11-13T15:00:00.000Z"),
  log: { info: () => undefined, warn: () => undefined },
};

type Cell = ExcelJS.CellValue;

/** Libro en memoria: una hoja por entrada, cada una con sus filas de celdas. */
async function workbookBuffer(
  sheets: Record<string, Cell[][]>,
  decorate?: (workbook: ExcelJS.Workbook) => void,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(name);
    rows.forEach((cells, r) => cells.forEach((value, c) => (sheet.getCell(r + 1, c + 1).value = value)));
  }
  decorate?.(workbook);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

describe("cellToText", () => {
  it("texto, vacío y booleanos", () => {
    expect(cellToText("Medellín")).toBe("Medellín");
    expect(cellToText(null)).toBeNull();
    expect(cellToText(undefined)).toBeNull();
    expect(cellToText(true)).toBe("Sí");
  });

  it("números sin notación científica ni ruido de coma flotante", () => {
    expect(cellToText(1750000)).toBe("1750000");
    expect(cellToText(1e21)).toBe("1000000000000000000000");
    expect(cellToText(1.5)).toBe("1.5");
    expect(cellToText(0.1 + 0.2)).toBe("0.3");
    expect(cellToText(0.0000001)).toBe("0.0000001");
    expect(cellToText(8)).toBe("8");
  });

  it("fechas en yyyy-mm-dd usando UTC (no corre el día)", () => {
    expect(cellToText(new Date(Date.UTC(2026, 11, 15)))).toBe("2026-12-15");
    expect(cellToText(new Date("2027-01-01T00:00:00.000Z"))).toBe("2027-01-01");
    expect(cellToText(new Date("2026-12-31T23:59:59.000Z"))).toBe("2026-12-31");
  });

  it("hipervínculos: la URL en columnas de enlace y el texto en las demás", () => {
    const link = { text: "Ver convocatoria", hyperlink: "https://example.com/a" };
    expect(cellToText(link, true)).toBe("https://example.com/a");
    expect(cellToText(link)).toBe("Ver convocatoria");
    expect(cellToText({ text: { richText: [{ text: "Ver " }, { text: "más" }] }, hyperlink: "https://example.com/b" })).toBe("Ver más");
    expect(cellToText({ text: "", hyperlink: "https://example.com/c" })).toBe("");
  });

  it("texto enriquecido concatenado, fórmulas por su resultado y errores como vacío", () => {
    expect(cellToText({ richText: [{ text: "Práctica " }, { font: { bold: true }, text: "profesional" }] })).toBe(
      "Práctica profesional",
    );
    expect(cellToText({ formula: 'A1&" S.A.S."', result: "Empresa S.A.S." })).toBe("Empresa S.A.S.");
    expect(cellToText({ formula: "1000000+750000", result: 1750000 })).toBe("1750000");
    expect(cellToText({ sharedFormula: "A2", result: new Date(Date.UTC(2026, 11, 1)) })).toBe("2026-12-01");
    expect(cellToText({ formula: "A1" })).toBeNull();
    expect(cellToText({ formula: "1/0", result: { error: "#DIV/0!" } })).toBeNull();
    expect(cellToText({ error: "#N/A" })).toBeNull();
  });
});

describe("readXlsxRecords", () => {
  it("convierte celdas de fecha, número, hipervínculo, texto enriquecido y fórmula después de guardar y leer el libro", async () => {
    const data = await workbookBuffer(
      {
        Convocatorias: [
          ["titulo", "organizacion", "pago", "fecha_limite", "fecha_inicio", "descripcion", "enlace_postulacion", "enlace_fuente"],
          [
            { richText: [{ text: "Practicante de " }, { font: { bold: true }, text: "Mercadeo" }] },
            { formula: '"Empresa "&"Ficticia"', result: "Empresa Ficticia" },
            1750000,
            new Date(Date.UTC(2026, 11, 15)),
            46054, // serial de Excel para 2026-02-01, con formato de fecha (se asigna abajo)
            { text: "Texto visible", hyperlink: "https://example.com/no-es-columna-de-enlace" },
            { text: "Postúlate aquí", hyperlink: "https://example.com/postular/mercadeo" },
            "https://example.com/fuente/mercadeo",
          ],
        ],
      },
      (workbook) => {
        workbook.getWorksheet("Convocatorias")!.getCell("E2").numFmt = "dd/mm/yyyy";
      },
    );

    const records = await readXlsxRecords(data);
    expect(records).toEqual([
      {
        rowNumber: 2,
        values: {
          titulo: "Practicante de Mercadeo",
          organizacion: "Empresa Ficticia",
          pago: "1750000",
          fecha_limite: "2026-12-15",
          fecha_inicio: "2026-02-01",
          descripcion: "Texto visible",
          enlace_postulacion: "https://example.com/postular/mercadeo",
          enlace_fuente: "https://example.com/fuente/mercadeo",
        },
      },
    ]);
  });

  it("ignora filas vacías o solo con formato, validación o espacios, sin correr la numeración", async () => {
    const data = await workbookBuffer(
      { Convocatorias: [["titulo", "organizacion", "tipo"], ["A", "B"], [], ["  ", ""], ["C", "D"]] },
      (workbook) => {
        const sheet = workbook.getWorksheet("Convocatorias")!;
        for (let row = 2; row <= 300; row += 1) {
          const cell = sheet.getCell(row, 3);
          cell.numFmt = "@";
          cell.alignment = { wrapText: true, vertical: "top" };
          cell.dataValidation = { type: "list", allowBlank: true, formulae: ['"Pasantía,Judicatura"'] };
        }
      },
    );
    const records = await readXlsxRecords(data);
    expect(records.map((r) => [r.rowNumber, r.values.titulo])).toEqual([
      [2, "A"],
      [5, "C"],
    ]);
  });

  it("si la hoja «Convocatorias» no existe, usa la primera del libro", async () => {
    const data = await workbookBuffer({
      Hoja1: [["titulo", "organizacion"], ["De la primera hoja", "B"]],
      Otra: [["titulo", "organizacion"], ["De la segunda hoja", "Z"]],
    });
    expect((await readXlsxRecords(data))[0].values.titulo).toBe("De la primera hoja");
    expect((await readXlsxRecords(data, "Otra"))[0].values.titulo).toBe("De la segunda hoja");
  });

  it("prefiere la hoja «Convocatorias» aunque no sea la primera", async () => {
    const data = await workbookBuffer({
      Instrucciones: [["Cómo llenar la plantilla"]],
      Convocatorias: [["titulo", "organizacion"], ["A", "B"]],
    });
    expect(await readXlsxRecords(data)).toEqual([{ rowNumber: 2, values: { titulo: "A", organizacion: "B" } }]);
  });

  it("reconoce encabezados con tildes, mayúsculas y espacios; ignora columnas desconocidas y filas en blanco iniciales", async () => {
    const data = await workbookBuffer({
      Convocatorias: [
        [],
        [" TÍTULO ", "Organización", "Notas internas", "FECHA_LÍMITE", "Enlace  Postulación", "fecha inicio"],
        ["A", "B", "se ignora", "2026-12-01", "https://example.com/a", "enero 2027"],
      ],
    });
    expect(await readXlsxRecords(data)).toEqual([
      {
        rowNumber: 3,
        values: {
          titulo: "A",
          organizacion: "B",
          fecha_limite: "2026-12-01",
          enlace_postulacion: "https://example.com/a",
          fecha_inicio: "enero 2027",
        },
      },
    ]);
  });

  it("libro sin datos → sin registros; sin columnas obligatorias o archivo inválido → error claro", async () => {
    expect(await readXlsxRecords(await workbookBuffer({ Convocatorias: [] }))).toEqual([]);
    expect(await readXlsxRecords(await workbookBuffer({ Convocatorias: [["titulo", "organizacion"]] }))).toEqual([]);
    await expect(readXlsxRecords(await workbookBuffer({ Datos: [["nombre", "empresa"], ["A", "B"]] }))).rejects.toThrow(
      /hoja «Datos» le faltan las columnas obligatorias: titulo, organizacion/,
    );
    await expect(readXlsxRecords(new TextEncoder().encode("titulo,organizacion\nA,B\n"))).rejects.toThrow(
      /No se pudo leer el archivo de Excel/,
    );
  });
});

describe("createXlsxAdapter", () => {
  it("convierte cada fila en un ítem crudo; externalId es la fila de Excel", async () => {
    const data = await workbookBuffer({
      Convocatorias: [
        ["titulo", "organizacion", "enlace_postulacion", "enlace_fuente"],
        ["A", "B", "https://example.com/postular/a", { text: "fuente", hyperlink: "https://example.com/fuente/a" }],
        [],
        ["C", "D"],
      ],
    });
    const adapter = createXlsxAdapter({ filePath: "/cargas/lote-1.xlsx", readBinary: async () => data });
    expect(adapter).toMatchObject({ id: "src-manual-xlsx", name: "Carga manual (Excel)", method: "manual", autoPublish: false });

    const raws = await adapter.fetch(ctx);
    expect(raws.map((r) => [r.externalId, r.url])).toEqual([
      ["2", "https://example.com/fuente/a"],
      ["4", "xlsx:lote-1.xlsx#fila-4"],
    ]);
    expect(raws.every((r) => r.sourceId === "src-manual-xlsx" && r.fetchedAt === "2026-11-13T15:00:00.000Z")).toBe(true);
    expect(adapter.parse(raws[1])).toMatchObject({ title: "C", organizationName: "D", applyUrl: null, sourceUrl: null });
  });

  it("la misma fila da el mismo payload y el mismo borrador en CSV y en Excel", async () => {
    const header = [...CSV_COLUMNS];
    const row = [
      "Practicante de Mercadeo",
      "Comercializadora Ficticia, Ltda.",
      "Práctica profesional",
      "Universitario, Tecnólogo",
      "Itagüí",
      "Híbrida",
      "$1.500.000",
      "6 meses",
      "15/12/2026",
      "",
      'Apoyo al equipo de "marca".\nSegunda línea.',
      "Mercadeo y afines",
      "A partir de 7° semestre",
      "Excel intermedio; Buena redacción",
      "",
      "https://example.com/postular/mercadeo",
      "https://example.com/fuente/mercadeo",
    ];
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csvText = `${header.join(",")}\n${row.map(quote).join(",")}\n`;

    const csv = createCsvAdapter({ filePath: "lote.csv", readText: async () => csvText });
    const xlsx = createXlsxAdapter({
      filePath: "lote.xlsx",
      readBinary: async () => workbookBuffer({ Convocatorias: [header, row.map((v) => (v === "" ? null : v))] }),
    });
    const [csvRaw] = await csv.fetch(ctx);
    const [xlsxRaw] = await xlsx.fetch(ctx);

    expect(xlsxRaw.payload).toEqual(csvRaw.payload);
    expect(xlsxRaw).toMatchObject({ externalId: csvRaw.externalId, url: csvRaw.url, fetchedAt: csvRaw.fetchedAt });
    expect(xlsx.parse(xlsxRaw)).toEqual(csv.parse(csvRaw));
  });
});

describe("plantilla convocatorias.xlsx", () => {
  const read = async () => new Uint8Array(readFileSync(templatePath("convocatorias.xlsx")));

  it("tiene las hojas, los encabezados exactos, la fila 1 fija y las listas desplegables", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await read()) as never);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(["Convocatorias", "Instrucciones"]);
    expect(workbook.views[0]).toMatchObject({ activeTab: 0 });

    const sheet = workbook.getWorksheet("Convocatorias")!;
    expect(CSV_COLUMNS.map((_, i) => sheet.getCell(1, i + 1).value)).toEqual([...CSV_COLUMNS]);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.autoFilter).toBeTruthy();
    expect(sheet.getCell("A1").note).toBeTruthy();

    const column = (name: (typeof CSV_COLUMNS)[number]) => CSV_COLUMNS.indexOf(name) + 1;
    for (const row of [2, 300]) {
      expect(sheet.getCell(row, column("tipo")).dataValidation).toMatchObject({ type: "list", errorStyle: "warning" });
      expect(sheet.getCell(row, column("modalidad")).dataValidation.formulae).toEqual(['"Presencial,Híbrida,Remota,Desconocida"']);
      // Sugerencias: nunca bloquean (nivel admite varios valores).
      expect(sheet.getCell(row, column("nivel")).dataValidation.showErrorMessage).toBeFalsy();
      expect(sheet.getCell(row, column("municipio")).dataValidation.formulae[0]).toMatch(/Medellín,.*Rionegro,Remoto/);
    }
  });

  it("se lee con dos filas de ejemplo ficticias, sin observaciones (las filas 4 a 300 no generan ítems)", async () => {
    const adapter = createXlsxAdapter({ filePath: "convocatorias.xlsx", readBinary: read, autoPublish: true });
    const raws = await adapter.fetch(ctx);
    expect(raws.map((r) => r.externalId)).toEqual(["2", "3"]);
    for (const raw of raws) {
      const draft = adapter.parse(raw);
      expect(draft.title).toMatch(/^EJEMPLO \(borrar\)/);
      expect(new URL(draft.applyUrl ?? "").hostname).toBe("example.com");
      expect(new URL(draft.sourceUrl ?? "").hostname).toBe("example.com");
      const normalized = normalizeDraft(draft, { today: "2026-11-13", sourceId: adapter.id, autoPublish: true });
      expect(normalized.issues).toEqual([]);
      expect(normalized.candidate.status).toBe("publicada");
    }
  });

  it("es equivalente a la plantilla CSV: mismos borradores fila por fila", async () => {
    const xlsx = createXlsxAdapter({ filePath: "convocatorias.xlsx", readBinary: read });
    const csv = createCsvAdapter({ filePath: templatePath("convocatorias.csv") });
    const xlsxRaws = await xlsx.fetch(ctx);
    const csvRaws = await csv.fetch(ctx);
    expect(xlsxRaws.map((r) => xlsx.parse(r))).toEqual(csvRaws.map((r) => csv.parse(r)));
    expect(xlsxRaws.map((r) => [r.externalId, r.url, r.payload])).toEqual(csvRaws.map((r) => [r.externalId, r.url, r.payload]));
  });
});

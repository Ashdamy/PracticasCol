import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { PoliteFetcher } from "../http";
import { normalizeDraft } from "../normalize";
import type { AdapterContext } from "../types";
import { createCsvAdapter, CSV_COLUMNS, detectDelimiter, parseCsv, readCsvRecords } from "./csv";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");
const template = () => readFileSync(fileURLToPath(new URL("../templates/convocatorias.csv", import.meta.url)), "utf8");

const http: PoliteFetcher = {
  get: async () => {
    throw new Error("El adaptador CSV no debe usar la red");
  },
  isAllowed: async () => false,
};
const ctx: AdapterContext = {
  http,
  now: new Date("2026-11-13T15:00:00.000Z"),
  log: { info: () => undefined, warn: () => undefined },
};

describe("parseCsv", () => {
  it("separa por comas y respeta comillas, comas internas y comillas escapadas", () => {
    expect(parseCsv('a,b,c\n1,"dos, con coma","dice ""hola"""\n')).toEqual([
      ["a", "b", "c"],
      ["1", "dos, con coma", 'dice "hola"'],
    ]);
  });

  it("detecta el punto y coma (Excel en español)", () => {
    expect(detectDelimiter("titulo;organizacion;pago\n")).toBe(";");
    expect(detectDelimiter("titulo,organizacion,pago\n")).toBe(",");
    // Los separadores dentro de comillas no cuentan, ni las líneas en blanco iniciales.
    expect(detectDelimiter('"a,b,c,d";e;f\n')).toBe(";");
    expect(detectDelimiter("\n\na;b;c\n1,5;2;3\n")).toBe(";");
    expect(parseCsv("a;b\n1,5;2\n")).toEqual([
      ["a", "b"],
      ["1,5", "2"],
    ]);
  });

  it("conserva los saltos de línea dentro de comillas", () => {
    expect(parseCsv('a,b\n"línea 1\nlínea 2",x\r\n"otra\r\nmás",y')).toEqual([
      ["a", "b"],
      ["línea 1\nlínea 2", "x"],
      ["otra\r\nmás", "y"],
    ]);
  });

  it("quita el BOM y acepta finales de línea \\r\\n", () => {
    expect(parseCsv("﻿titulo,organizacion\r\nA,B\r\n")).toEqual([
      ["titulo", "organizacion"],
      ["A", "B"],
    ]);
  });

  it("conserva los campos vacíos, también al final de la fila", () => {
    expect(parseCsv('a,,c,\n,"",\n')).toEqual([
      ["a", "", "c", ""],
      ["", "", ""],
    ]);
  });

  it("falla con un mensaje claro si una comilla queda sin cerrar", () => {
    expect(() => parseCsv('a,b\n"sin cerrar,x\n')).toThrow(/comilla doble sin cerrar/);
  });
});

describe("readCsvRecords", () => {
  it("fixture con comas: BOM, encabezados con tildes y mayúsculas, salto de línea entre comillas y fila vacía", () => {
    const text = fixture("comas.csv");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const records = readCsvRecords(text);
    expect(records).toHaveLength(2);

    const [first, second] = records;
    expect(first.rowNumber).toBe(2);
    expect(first.values).toMatchObject({
      titulo: "Practicante de Mercadeo",
      organizacion: "Comercializadora Ficticia, Ltda.",
      pago: "$1.500.000",
      fecha_limite: "15/12/2026",
      descripcion: 'Apoyo al equipo de "marca" en campañas.\nSegunda línea de la descripción.',
      requisitos: "Excel intermedio\nBuena redacción",
      enlace_postulacion: "https://example.com/postular/mercadeo",
      enlace_fuente: "https://example.com/fuente/mercadeo",
    });
    // Las celdas vacías no generan llave y las columnas desconocidas se ignoran.
    expect(first.values).not.toHaveProperty("fecha_inicio");
    expect(Object.keys(first.values).every((k) => (CSV_COLUMNS as readonly string[]).includes(k))).toBe(true);

    // La fila vacía (la 3 de la hoja) se salta sin correr la numeración.
    expect(second.rowNumber).toBe(4);
    expect(second.values).toMatchObject({
      titulo: "Auxiliar contable",
      instituciones: "SENA",
      fecha_limite: "Hasta agotar cupos",
    });
    expect(second.values).not.toHaveProperty("enlace_fuente");
  });

  it("fixture con punto y coma: conserva comas y punto y coma dentro de las celdas", () => {
    const records = readCsvRecords(fixture("punto-y-coma.csv"));
    expect(records).toHaveLength(1);
    expect(records[0].values).toEqual({
      titulo: "Pasante de Comunicaciones",
      organizacion: "Fundación Ficticia Cuatro",
      tipo: "Pasantía",
      nivel: "Universitario",
      municipio: "Itagüí, Antioquia",
      pago: "1,2 millones",
      fecha_limite: "2026-12-20",
      requisitos: "Portafolio; Manejo de redes",
      enlace_postulacion: "https://example.com/postular/comunicaciones",
    });
  });

  it("reconoce encabezados sin importar mayúsculas, tildes, espacios o guiones bajos", () => {
    const csv =
      " TÍTULO ,Organización,FECHA_LÍMITE,Enlace  Postulación,fecha inicio\nA,B,2026-12-01,https://example.com/a,2027-01-15\n";
    expect(readCsvRecords(csv)[0].values).toEqual({
      titulo: "A",
      organizacion: "B",
      fecha_limite: "2026-12-01",
      enlace_postulacion: "https://example.com/a",
      fecha_inicio: "2027-01-15",
    });
  });

  it("ignora filas vacías (también con espacios) y líneas en blanco antes del encabezado", () => {
    const csv = "\n\ntitulo,organizacion\n\n , \nA,B\n,,\n\nC,D\n\n";
    expect(readCsvRecords(csv).map((r) => [r.rowNumber, r.values.titulo])).toEqual([
      [6, "A"],
      [9, "C"],
    ]);
  });

  it("archivo vacío o solo con encabezados → sin registros", () => {
    expect(readCsvRecords("")).toEqual([]);
    expect(readCsvRecords("﻿\n\n")).toEqual([]);
    expect(readCsvRecords("titulo,organizacion\n")).toEqual([]);
  });

  it("exige las columnas titulo y organizacion", () => {
    expect(() => readCsvRecords("nombre,empresa\nA,B\n")).toThrow(/columnas obligatorias: titulo, organizacion/);
    expect(() => readCsvRecords("titulo,empresa\nA,B\n")).toThrow(/columnas obligatorias: organizacion/);
  });
});

describe("createCsvAdapter", () => {
  it("convierte cada fila en un ítem crudo y luego en borrador", async () => {
    const adapter = createCsvAdapter({ filePath: "/datos/comas.csv", readText: async () => fixture("comas.csv") });
    expect(adapter).toMatchObject({ id: "src-manual-csv", method: "manual", autoPublish: false });

    const raws = await adapter.fetch(ctx);
    expect(raws.map((r) => [r.externalId, r.url])).toEqual([
      ["2", "https://example.com/fuente/mercadeo"],
      ["4", "https://example.com/postular/contable"],
    ]);
    expect(raws.every((r) => r.sourceId === "src-manual-csv" && r.fetchedAt === "2026-11-13T15:00:00.000Z")).toBe(true);

    expect(adapter.parse(raws[1])).toEqual({
      title: "Auxiliar contable",
      organizationName: "Organización Ficticia Tres",
      typeText: "Contrato de aprendizaje",
      levelText: "Técnico laboral",
      municipalityText: "Bello",
      modalityText: "Presencial",
      compensationText: "Apoyo de sostenimiento",
      durationText: "6 meses",
      deadlineText: "Hasta agotar cupos",
      startDateText: null,
      description: "Registro de operaciones contables.",
      programsText: "Técnico en Contabilización de Operaciones Comerciales y Financieras",
      semesterText: null,
      requirementsText: null,
      institutionsText: "SENA",
      applyUrl: "https://example.com/postular/contable",
      sourceUrl: null,
    });
  });

  it("sin enlaces usa una referencia al archivo y la fila", async () => {
    const adapter = createCsvAdapter({
      id: "src-po",
      filePath: "/cargas/lote-1.csv",
      readText: async () => "titulo,organizacion\nA,B\n",
    });
    const [raw] = await adapter.fetch(ctx);
    expect(raw).toMatchObject({ sourceId: "src-po", externalId: "2", url: "csv:lote-1.csv#fila-2" });
  });

  it("la plantilla es válida: encabezados completos y dos filas de ejemplo ficticias sin observaciones", async () => {
    const text = template();
    expect(parseCsv(text)[0]).toEqual([...CSV_COLUMNS]);

    const adapter = createCsvAdapter({ filePath: "convocatorias.csv", readText: async () => text, autoPublish: true });
    const raws = await adapter.fetch(ctx);
    expect(raws).toHaveLength(2);
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
});

import { describe, expect, it } from "vitest";
import { createFakeSupabase, op } from "@/test/fake-supabase";
import {
  clipComment,
  formatBogotaDateTime,
  formatReport,
  formatReportList,
  listIssueReports,
  markReportResolved,
  resolveReportId,
  rowToIssueReport,
  selectReports,
  suggestAction,
  type IssueReport,
  type IssueReportRow,
  type ReportedOpportunity,
} from "./admin-reports";

const OPP_ID = "0b8f6c1e-2a4d-4e7b-9c3a-5d6e7f8a9b0c";
const REPORT_ID = "3f2a9c1d-1111-4111-8111-111111111111";

function report(overrides: Partial<IssueReport> = {}): IssueReport {
  return {
    id: REPORT_ID,
    opportunityId: OPP_ID,
    reason: "enlace_roto",
    comment: "Al dar clic sale un error 404.",
    resolved: false,
    resolvedAt: null,
    createdAt: "2026-11-17T14:42:00.000Z",
    ...overrides,
  };
}

function opportunity(overrides: Partial<ReportedOpportunity> = {}): ReportedOpportunity {
  return { id: OPP_ID, title: "Practicante de datos", organizationName: "Empresa Ficticia", status: "publicada", ...overrides };
}

describe("formatBogotaDateTime", () => {
  it("muestra fecha y hora de Colombia (UTC-5)", () => {
    expect(formatBogotaDateTime("2026-11-17T14:42:00.000Z")).toBe("2026-11-17 09:42");
    // Las 03:10 UTC todavía son el día anterior en Colombia.
    expect(formatBogotaDateTime("2026-11-17T03:10:00+00:00")).toBe("2026-11-16 22:10");
    expect(formatBogotaDateTime("2026-11-17T05:00:00Z")).toBe("2026-11-17 00:00");
  });

  it("devuelve el texto tal cual si no es una fecha", () => {
    expect(formatBogotaDateTime("no-es-fecha")).toBe("no-es-fecha");
  });
});

describe("clipComment", () => {
  it("deja el comentario en una línea y sin caracteres de control", () => {
    expect(clipComment("  El enlace\r\n no abre\t\u001b[31m ya  ")).toBe("El enlace no abre [31m ya");
    expect(clipComment(null)).toBe("");
  });

  it("recorta a 200 caracteres con puntos suspensivos", () => {
    const clipped = clipComment("a".repeat(500));
    expect(clipped).toHaveLength(200);
    expect(clipped.endsWith("…")).toBe(true);
    expect(clipComment("a".repeat(200))).toBe("a".repeat(200));
  });
});

describe("resolveReportId", () => {
  const all = [
    { id: "3f2a9c1d-1111-4111-8111-111111111111" },
    { id: "3f2a9c1d-2222-4222-8222-222222222222" },
    { id: "aaaaaaaa-3333-4333-8333-333333333333" },
  ];

  it("acepta el id completo y el id corto (sin importar mayúsculas)", () => {
    expect(resolveReportId("AAAAAAAA", all)).toBe(all[2]);
    expect(resolveReportId(" aaaaaaaa-3333-4333-8333-333333333333 ", all)).toBe(all[2]);
    expect(resolveReportId("3f2a9c1d-2222-4222-8222-222222222222", all)).toBe(all[1]);
  });

  it("falla con un mensaje claro si no existe, es ambiguo o es muy corto", () => {
    expect(() => resolveReportId("bbbbbbbb", all)).toThrow("No hay ningún reporte con id «bbbbbbbb»");
    expect(() => resolveReportId("3f2a9c1d", all)).toThrow("coincide con 2 reportes");
    expect(() => resolveReportId("aaa", all)).toThrow("No hay ningún reporte");
    expect(() => resolveReportId("  ", all)).toThrow("Falta el id del reporte");
  });
});

describe("suggestAction", () => {
  it("vencida y enlace roto: deja listo el comando para retirar", () => {
    expect(suggestAction("vencida", opportunity())).toBe(
      "Si confirmas que ya cerró, retírala: npm run admin -- retirar 0b8f6c1e",
    );
    expect(suggestAction("enlace_roto", opportunity())).toBe(
      "Si confirmas que el enlace no funciona, retírala: npm run admin -- retirar 0b8f6c1e",
    );
  });

  it("sospechosa: pide prioridad y deja el mismo comando", () => {
    const text = suggestAction("sospechosa", opportunity());
    expect(text).toContain("prioridad");
    expect(text).toContain("npm run admin -- retirar 0b8f6c1e");
  });

  it("los demás motivos no tienen acción sugerida", () => {
    expect(suggestAction("datos_incorrectos", opportunity())).toBeNull();
    expect(suggestAction("otro", opportunity())).toBeNull();
  });

  it("no sugiere retirar lo que ya está retirado ni lo que no existe", () => {
    expect(suggestAction("vencida", opportunity({ status: "retirada" }))).toContain("ya está retirada");
    expect(suggestAction("vencida", opportunity({ status: "retirada" }))).not.toContain("npm run admin");
    expect(suggestAction("sospechosa", undefined)).toBeNull();
  });
});

describe("formatReport", () => {
  it("muestra id corto, fecha, motivo, convocatoria, comentario y sugerencia", () => {
    expect(formatReport(report(), opportunity())).toBe(
      [
        "3f2a9c1d  2026-11-17 09:42  El enlace no funciona",
        "          Convocatoria: 0b8f6c1e «Practicante de datos» — Empresa Ficticia [Publicada]",
        "          Comentario: Al dar clic sale un error 404.",
        "          Sugerencia: Si confirmas que el enlace no funciona, retírala: npm run admin -- retirar 0b8f6c1e",
      ].join("\n"),
    );
  });

  it("sin comentario ni sugerencia solo quedan dos líneas", () => {
    const text = formatReport(report({ reason: "otro", comment: null }), opportunity({ title: "", organizationName: "" }));
    expect(text.split("\n")).toEqual([
      "3f2a9c1d  2026-11-17 09:42  Otro motivo",
      "          Convocatoria: 0b8f6c1e «(sin título)» — (sin organización) [Publicada]",
    ]);
  });

  it("marca los resueltos y no les sugiere nada", () => {
    const text = formatReport(report({ resolved: true, resolvedAt: "2026-11-18T15:00:00Z" }), opportunity());
    expect(text).toContain("El enlace no funciona  [RESUELTO 2026-11-18 10:00]");
    expect(text).not.toContain("Sugerencia");
    expect(formatReport(report({ resolved: true }), opportunity())).toContain("[RESUELTO]");
  });

  it("avisa si la convocatoria no está", () => {
    expect(formatReport(report(), undefined)).toContain("Convocatoria: 0b8f6c1e (no encontrada)");
  });
});

describe("selectReports y formatReportList", () => {
  const older = report({ id: "aaaaaaaa-1111-4111-8111-111111111111", createdAt: "2026-11-15T10:00:00Z", reason: "vencida" });
  const newer = report({ id: "bbbbbbbb-1111-4111-8111-111111111111", createdAt: "2026-11-17T10:00:00Z" });
  const done = report({
    id: "cccccccc-1111-4111-8111-111111111111",
    createdAt: "2026-11-16T10:00:00Z",
    resolved: true,
    resolvedAt: "2026-11-16T12:00:00Z",
  });

  it("solo los no resueltos, los más recientes primero", () => {
    expect(selectReports([older, done, newer], false).map((r) => r.id)).toEqual([newer.id, older.id]);
    expect(selectReports([older, done, newer], true).map((r) => r.id)).toEqual([newer.id, done.id, older.id]);
  });

  it("lista con encabezado y recordatorio de cómo cerrar", () => {
    const text = formatReportList([older, done, newer], [opportunity()], false);
    expect(text.startsWith("Reportes sin resolver: 2\nbbbbbbbb")).toBe(true);
    expect(text).not.toContain("cccccccc");
    expect(text.endsWith("npm run admin -- resolver <id-reporte>")).toBe(true);
  });

  it("--todos incluye los resueltos, marcados", () => {
    const text = formatReportList([older, done, newer], [opportunity()], true);
    expect(text.startsWith("Reportes: 3 (2 sin resolver)")).toBe(true);
    expect(text).toContain("cccccccc  2026-11-16 05:00  El enlace no funciona  [RESUELTO 2026-11-16 07:00]");
  });

  it("mensajes claros cuando no hay nada", () => {
    expect(formatReportList([], [], false)).toBe("No hay reportes sin resolver.");
    expect(formatReportList([], [], true)).toBe("No hay reportes.");
    expect(formatReportList([done], [opportunity()], false)).toBe(
      "No hay reportes sin resolver (1 ya resuelto: usa --todos para verlos).",
    );
  });
});

describe("acceso a Supabase (cliente falso)", () => {
  const row: IssueReportRow = {
    id: REPORT_ID,
    opportunity_id: OPP_ID,
    reason: "sospechosa",
    comment: null,
    resolved: false,
    resolved_at: null,
    created_at: "2026-11-17T14:42:00+00:00",
  };

  it("listIssueReports lee la tabla ordenada por fecha descendente y convierte las filas", async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: [row] }));
    expect(await listIssueReports(client)).toEqual([rowToIssueReport(row)]);
    expect(queries).toHaveLength(1);
    expect(queries[0].table).toBe("issue_reports");
    expect(op(queries[0], "select")?.[0]).toContain("resolved_at");
    expect(op(queries[0], "order")).toEqual(["created_at", { ascending: false }]);
    expect(op(queries[0], "update")).toBeUndefined();
  });

  it("listIssueReports explica el error de la base de datos", async () => {
    const { client } = createFakeSupabase(() => ({ error: { message: "column resolved_at does not exist" } }));
    await expect(listIssueReports(client)).rejects.toThrow("no se pudo leer los reportes");
  });

  it("markReportResolved marca resolved y resolved_at solo en ese reporte", async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: [{ id: REPORT_ID }] }));
    await markReportResolved(client, REPORT_ID, new Date("2026-11-18T15:00:00.000Z"));
    expect(queries).toHaveLength(1);
    expect(queries[0].table).toBe("issue_reports");
    expect(op(queries[0], "update")).toEqual([{ resolved: true, resolved_at: "2026-11-18T15:00:00.000Z" }]);
    expect(op(queries[0], "eq")).toEqual(["id", REPORT_ID]);
  });

  it("markReportResolved falla si el reporte no existe", async () => {
    const { client } = createFakeSupabase(() => ({ data: [] }));
    await expect(markReportResolved(client, REPORT_ID)).rejects.toThrow(`No existe el reporte ${REPORT_ID}`);
  });
});

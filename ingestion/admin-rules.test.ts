import { describe, expect, it } from "vitest";
import {
  approvalProblems,
  decideApproval,
  formatListItem,
  parseAdminArgs,
  resolveTarget,
  shortId,
  type Approvable,
} from "./admin-rules";

const TODAY = "2026-11-16";

function opportunity(overrides: Partial<Approvable> = {}): Approvable {
  return {
    title: "Practicante de datos",
    organizationId: "11111111-1111-4111-8111-111111111111",
    organizationName: "Empresa Ficticia",
    applyUrl: "https://example.com/postular",
    deadlineType: "fecha",
    deadlineDate: "2026-12-15",
    status: "en_revision",
    ...overrides,
  };
}

const messages = (o: Approvable) => approvalProblems(o, TODAY).map((p) => p.message);

describe("approvalProblems", () => {
  it("una convocatoria completa se puede aprobar", () => {
    expect(approvalProblems(opportunity(), TODAY)).toEqual([]);
    expect(decideApproval(opportunity(), TODAY, false).approve).toBe(true);
  });

  it("se niega si falta el título, la organización o el enlace https", () => {
    expect(messages(opportunity({ title: "  " }))).toEqual(["falta el título"]);
    expect(messages(opportunity({ organizationId: "", organizationName: "" }))).toEqual(["falta la organización"]);
    expect(messages(opportunity({ applyUrl: "" }))).toEqual(["falta el enlace de postulación"]);
    expect(messages(opportunity({ applyUrl: "http://example.com" }))).toEqual(["el enlace de postulación no es https"]);
    expect(messages(opportunity({ applyUrl: "example.com/postular" }))).toEqual(["el enlace de postulación no es https"]);
  });

  it("avisa si la fecha límite ya pasó; el día de cierre todavía vale", () => {
    expect(messages(opportunity({ deadlineDate: "2026-11-15" }))).toEqual(["la fecha límite ya pasó (2026-11-15)"]);
    expect(messages(opportunity({ deadlineDate: TODAY }))).toEqual([]);
    expect(messages(opportunity({ deadlineType: "hasta_agotar_cupos", deadlineDate: null }))).toEqual([]);
  });

  it("no vuelve a aprobar lo ya publicado", () => {
    expect(decideApproval(opportunity({ status: "publicada" }), TODAY, true).approve).toBe(false);
  });
});

describe("decideApproval con --forzar", () => {
  it("salta el título, el https y la fecha", () => {
    const risky = opportunity({ title: "", applyUrl: "http://example.com", deadlineDate: "2026-11-01" });
    expect(decideApproval(risky, TODAY, false).approve).toBe(false);
    const forced = decideApproval(risky, TODAY, true);
    expect(forced.approve).toBe(true);
    expect(forced.problems).toHaveLength(3);
  });

  it("nunca publica sin organización o sin enlace", () => {
    expect(decideApproval(opportunity({ organizationId: "", organizationName: "" }), TODAY, true).approve).toBe(false);
    expect(decideApproval(opportunity({ applyUrl: " " }), TODAY, true).approve).toBe(false);
  });
});

describe("resolveTarget", () => {
  const all = [
    { id: "0b8f6c1e-2a4d-4e7b-9c3a-5d6e7f8a9b0c", slug: "practica-uno" },
    { id: "0b8f6c1e-ffff-4e7b-9c3a-5d6e7f8a9b0c", slug: "practica-dos" },
    { id: "9a7b6c5d-2a4d-4e7b-9c3a-5d6e7f8a9b0c", slug: "practica-tres" },
  ];

  it("encuentra por id completo, slug e id corto", () => {
    expect(resolveTarget(all[0].id, all)).toBe(all[0]);
    expect(resolveTarget("practica-dos", all)).toBe(all[1]);
    expect(resolveTarget(shortId(all[2].id), all)).toBe(all[2]);
    expect(resolveTarget("9A7B6C5D", all)).toBe(all[2]);
  });

  it("rechaza un id corto ambiguo, uno demasiado corto y lo que no existe", () => {
    expect(() => resolveTarget("0b8f6c1e", all)).toThrow("coincide con 2 convocatorias");
    expect(() => resolveTarget("9a7b", all)).toThrow("No hay ninguna convocatoria");
    expect(() => resolveTarget("no-existe", all)).toThrow("No hay ninguna convocatoria");
    expect(() => resolveTarget(" ", all)).toThrow("Falta el id o el slug");
  });
});

describe("parseAdminArgs", () => {
  it("separa comando, objetivos y opciones", () => {
    expect(parseAdminArgs(["aprobar", "abc12345", "otro-slug", "--forzar"])).toEqual({
      command: "aprobar",
      targets: ["abc12345", "otro-slug"],
      force: true,
      all: false,
      help: false,
      site: null,
      logo: null,
      noLogo: false,
    });
    expect(parseAdminArgs([])).toMatchObject({ command: null, targets: [], force: false, all: false, help: false });
    expect(parseAdminArgs(["reportes", "--todos"])).toMatchObject({ command: "reportes", all: true, targets: [] });
  });

  it("lee las opciones de `empresa` (con valor aparte o con =)", () => {
    expect(parseAdminArgs(["empresa", "Banco de Occidente", "--sitio", "bancodeoccidente.com.co"])).toMatchObject({
      command: "empresa",
      targets: ["Banco de Occidente"],
      site: "bancodeoccidente.com.co",
      logo: null,
      noLogo: false,
    });
    expect(parseAdminArgs(["empresa", "Axity", "--logo=https://example.com/a.png"])).toMatchObject({
      targets: ["Axity"],
      logo: "https://example.com/a.png",
    });
    expect(parseAdminArgs(["empresa", "Axity", "--sin-logo"])).toMatchObject({ noLogo: true, site: null });
  });

  it("exige el valor de --sitio y --logo", () => {
    expect(() => parseAdminArgs(["empresa", "Axity", "--sitio"])).toThrow("Falta el valor de --sitio");
    expect(() => parseAdminArgs(["empresa", "Axity", "--logo", "--sin-logo"])).toThrow("Falta el valor de --logo");
  });

  it("rechaza opciones desconocidas", () => {
    expect(() => parseAdminArgs(["revision", "--borrar-todo"])).toThrow("Opción desconocida");
  });
});

describe("formatListItem", () => {
  it("muestra id corto, título, organización, fuente y observaciones", () => {
    const text = formatListItem(
      {
        id: "0b8f6c1e-2a4d-4e7b-9c3a-5d6e7f8a9b0c",
        title: "Practicante de datos",
        organizationName: "",
        sources: [{ sourceId: "src-manual-xlsx", url: "https://example.com" }],
        reviewNotes: ["Organización: falta la organización"],
      },
      new Map([["src-manual-xlsx", "Carga manual (Excel)"]]),
    );
    expect(text).toBe(
      "0b8f6c1e  Practicante de datos — (sin organización) [Carga manual (Excel)]\n          - Organización: falta la organización",
    );
  });
});

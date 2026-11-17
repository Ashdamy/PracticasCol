import { describe, expect, it } from "vitest";
import { createFakeSupabase, op } from "@/test/fake-supabase";
import {
  applyOrganizationPatch,
  formatOrganizationList,
  listOrganizations,
  logoStatus,
  organizationPatch,
  resolveOrganization,
  updateOrganization,
  type AdminOrganization,
} from "./admin-organizations";

const CLIENT = "client-123";

function org(name: string, extra: Partial<AdminOrganization> = {}): AdminOrganization {
  return { id: `id-${name}`, name, website: null, logoUrl: null, ...extra };
}

const ALL = [org("Grupo Éxito"), org("Grupo UMA"), org("Bancolombia"), org("Banco de Occidente"), org("Postobón S.A.")];

describe("resolveOrganization", () => {
  it("encuentra por nombre exacto, sin importar tildes ni mayúsculas", () => {
    expect(resolveOrganization("grupo exito", ALL).name).toBe("Grupo Éxito");
    expect(resolveOrganization("  BANCOLOMBIA ", ALL).name).toBe("Bancolombia");
  });

  it("encuentra por una parte única del nombre", () => {
    expect(resolveOrganization("postobon", ALL).name).toBe("Postobón S.A.");
    expect(resolveOrganization("Occidente", ALL).name).toBe("Banco de Occidente");
  });

  it("el nombre exacto gana aunque sea parte de otro", () => {
    const all = [org("Kalley"), org("Kalley Servicios")];
    expect(resolveOrganization("kalley", all).name).toBe("Kalley");
  });

  it("falla con un mensaje claro si es ambiguo, no existe o está vacío", () => {
    expect(() => resolveOrganization("grupo", ALL)).toThrow("coincide con 2 empresas: «Grupo Éxito», «Grupo UMA»");
    expect(() => resolveOrganization("banco", ALL)).toThrow("coincide con 2 empresas");
    expect(() => resolveOrganization("Nutresa", ALL)).toThrow("No hay ninguna empresa cuyo nombre contenga «Nutresa»");
    expect(() => resolveOrganization("   ", ALL)).toThrow("Falta el nombre");
  });
});

describe("organizationPatch", () => {
  it("normaliza el sitio a dominio", () => {
    expect(organizationPatch({ site: "https://www.Bancolombia.com/personas", logo: null, noLogo: false })).toEqual({
      website: "bancolombia.com",
    });
  });

  it("acepta un logo https y lo combina con el sitio", () => {
    expect(organizationPatch({ site: "axity.com", logo: "https://example.com/axity.png", noLogo: false })).toEqual({
      website: "axity.com",
      logoUrl: "https://example.com/axity.png",
    });
  });

  it("--sin-logo borra sitio y logo", () => {
    expect(organizationPatch({ site: null, logo: null, noLogo: true })).toEqual({ website: null, logoUrl: null });
  });

  it("rechaza valores inválidos, combinaciones y la falta de opciones", () => {
    expect(() => organizationPatch({ site: "no es dominio", logo: null, noLogo: false })).toThrow("no es un dominio válido");
    expect(() => organizationPatch({ site: null, logo: "http://example.com/a.png", noLogo: false })).toThrow("no es una URL https");
    expect(() => organizationPatch({ site: null, logo: "logo.png", noLogo: false })).toThrow("no es una URL https");
    expect(() => organizationPatch({ site: "axity.com", logo: null, noLogo: true })).toThrow("no se combina");
    expect(() => organizationPatch({ site: null, logo: null, noLogo: false })).toThrow("Indica qué cambiar");
  });
});

describe("applyOrganizationPatch", () => {
  it("cambia solo lo que trae el cambio", () => {
    const before = org("Axity", { website: "axity.com", logoUrl: "https://example.com/a.png" });
    expect(applyOrganizationPatch(before, { website: "axity.mx" })).toMatchObject({
      website: "axity.mx",
      logoUrl: "https://example.com/a.png",
    });
    expect(applyOrganizationPatch(before, { website: null, logoUrl: null })).toMatchObject({ website: null, logoUrl: null });
  });
});

describe("logoStatus y formatOrganizationList", () => {
  const list = [
    org("Postobón S.A.", { website: "postobon.com" }),
    org("Axity", { website: "axity.com", logoUrl: "https://example.com/axity.png" }),
    org("IBLU"),
    org("Empresa de retail (confidencial)", { website: "retail.com" }),
  ];

  it("explica por qué habrá o no logo", () => {
    expect(list.map((o) => logoStatus(o, CLIENT))).toEqual([
      "sí (Brandfetch)",
      "sí (logo propio)",
      "no (sin sitio web)",
      "no (confidencial o agencia)",
    ]);
    expect(logoStatus(list[0], null)).toBe("no (falta NEXT_PUBLIC_BRANDFETCH_CLIENT_ID)");
    expect(logoStatus(org("X", { website: "sin sitio" }), CLIENT)).toBe("no (el sitio no es un dominio válido)");
  });

  it("lista en orden alfabético con resumen y sin mostrar el client ID", () => {
    const text = formatOrganizationList(list, CLIENT);
    const lines = text.split("\n");
    expect(lines[0]).toBe("Empresas: 4 (con logo: 2, con iniciales: 2)");
    expect(lines[1]).toMatch(/^Empresa\s+Sitio web\s+Logo propio\s+¿Tendrá logo\?$/);
    expect(lines.slice(2).map((l) => l.split("  ")[0])).toEqual([
      "Axity",
      "Empresa de retail (confidencial)",
      "IBLU",
      "Postobón S.A.",
    ]);
    expect(lines[2]).toContain("https://example.com/axity.png");
    expect(lines[4]).toMatch(/IBLU\s+—\s+—\s+no \(sin sitio web\)/);
    expect(text).not.toContain(CLIENT);
  });
});

describe("Supabase", () => {
  it("listOrganizations lee y convierte las filas", async () => {
    const { client, queries } = createFakeSupabase((q) =>
      q.table === "organizations"
        ? { data: [{ id: "o1", name: "Axity", website: "axity.com", logo_url: null }] }
        : undefined,
    );
    expect(await listOrganizations(client)).toEqual([{ id: "o1", name: "Axity", website: "axity.com", logoUrl: null }]);
    expect(op(queries[0], "select")).toEqual(["id, name, website, logo_url"]);
  });

  it("updateOrganization escribe solo las columnas del cambio", async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: [{ id: "o1" }] }));
    await updateOrganization(client, "o1", { website: "axity.com" });
    expect(op(queries[0], "update")).toEqual([{ website: "axity.com" }]);
    expect(op(queries[0], "eq")).toEqual(["id", "o1"]);

    await updateOrganization(client, "o1", { website: null, logoUrl: null });
    expect(op(queries[1], "update")).toEqual([{ website: null, logo_url: null }]);
  });

  it("updateOrganization falla si la empresa no existe", async () => {
    const { client } = createFakeSupabase(() => ({ data: [] }));
    await expect(updateOrganization(client, "o9", { website: "axity.com" })).rejects.toThrow("No existe la empresa o9");
  });
});

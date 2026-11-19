import { describe, expect, it } from "vitest";
import { brandfetchLogoUrl, isLogoExcluded, logoUrlFor, readBrandfetchClientId, websiteDomain } from "./logos";

const CLIENT = "client-123";

describe("websiteDomain", () => {
  it("quita protocolo, www, puerto, ruta y parámetros", () => {
    expect(websiteDomain("https://www.Bancolombia.com/personas?x=1#y")).toBe("bancolombia.com");
    expect(websiteDomain("http://grupoexito.com.co:8080/")).toBe("grupoexito.com.co");
    expect(websiteDomain("  WWW.postobon.com  ")).toBe("postobon.com");
    expect(websiteDomain("carreras.empresa.com.co/vacantes")).toBe("carreras.empresa.com.co");
    expect(websiteDomain("gb-advisors.com")).toBe("gb-advisors.com");
  });

  it("devuelve null si no es un dominio", () => {
    for (const value of [null, undefined, "", "   ", "localhost", "http://localhost:3000", "192.168.0.1", "no tiene sitio", "empresa", "-a.com"]) {
      expect(websiteDomain(value)).toBeNull();
    }
  });
});

describe("isLogoExcluded", () => {
  it("excluye confidenciales y agencias con empresa cliente", () => {
    expect(isLogoExcluded("Empresa de alimentos (confidencial)")).toBe(true);
    expect(isLogoExcluded("Agencia Temporal (Empresa Cliente)")).toBe(true);
    expect(isLogoExcluded("Bancolombia")).toBe(false);
    expect(isLogoExcluded("Grupo BIOS (OPAV)")).toBe(false);
  });
});

describe("brandfetchLogoUrl", () => {
  it("arma el ícono cuadrado con fallback 404 y el client ID", () => {
    expect(brandfetchLogoUrl("bancolombia.com", CLIENT)).toBe(
      "https://cdn.brandfetch.io/domain/bancolombia.com/w/128/h/128/fallback/404/icon?c=client-123",
    );
  });
});

describe("logoUrlFor", () => {
  it("prefiere el logo explícito", () => {
    const org = { name: "Org", logoUrl: " https://example.com/logo.png ", website: "org.com" };
    expect(logoUrlFor(org, CLIENT)).toBe("https://example.com/logo.png");
    expect(logoUrlFor(org, null)).toBe("https://example.com/logo.png");
  });

  it("usa Brandfetch con el dominio del sitio web", () => {
    expect(logoUrlFor({ name: "Org", logoUrl: null, website: "https://www.org.com.co/empleo" }, CLIENT)).toBe(
      brandfetchLogoUrl("org.com.co", CLIENT),
    );
  });

  it("sin client ID, sin sitio o con un sitio inválido no hay logo", () => {
    expect(logoUrlFor({ name: "Org", logoUrl: null, website: "org.com" }, null)).toBeNull();
    expect(logoUrlFor({ name: "Org", logoUrl: null, website: "org.com" }, "  ")).toBeNull();
    expect(logoUrlFor({ name: "Org", logoUrl: null, website: null }, CLIENT)).toBeNull();
    expect(logoUrlFor({ name: "Org", logoUrl: null }, CLIENT)).toBeNull();
    expect(logoUrlFor({ name: "Org", logoUrl: "", website: "sin sitio" }, CLIENT)).toBeNull();
  });

  it("nunca da logo a confidenciales ni a agencias, aunque tengan datos", () => {
    const data = { logoUrl: "https://example.com/logo.png", website: "org.com" };
    expect(logoUrlFor({ name: "Empresa del sector retail (confidencial)", ...data }, CLIENT)).toBeNull();
    expect(logoUrlFor({ name: "Temporal XYZ (empresa cliente)", ...data }, CLIENT)).toBeNull();
  });
});

describe("readBrandfetchClientId", () => {
  it("lee la variable pública o devuelve null", () => {
    expect(readBrandfetchClientId({ NEXT_PUBLIC_BRANDFETCH_CLIENT_ID: " abc " })).toBe("abc");
    expect(readBrandfetchClientId({ NEXT_PUBLIC_BRANDFETCH_CLIENT_ID: "" })).toBeNull();
    expect(readBrandfetchClientId({})).toBeNull();
  });
});

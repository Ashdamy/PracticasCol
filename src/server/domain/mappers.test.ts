import { describe, expect, it } from "vitest";
import { MOCK_OPPORTUNITIES, MOCK_ORGANIZATIONS, MOCK_SOURCES } from "@/lib/mocks/data";
import { mockCards } from "@/lib/mocks";
import { todayInBogota } from "@/lib/time";
import { searchRecords } from "@/server/search/engine";
import { brandfetchLogoUrl } from "./logos";
import { toCard, toDetail, type MapContext } from "./mappers";

function ctx(): MapContext {
  const now = new Date();
  return {
    organizations: new Map(MOCK_ORGANIZATIONS.map((o) => [o.id, o])),
    sources: new Map(MOCK_SOURCES.map((s) => [s.id, s])),
    now,
    today: todayInBogota(now),
    profile: null,
  };
}

describe("toCard: source.url (contrato v0.1.1)", () => {
  it("toda tarjeta trae la URL de su fuente", () => {
    const r = searchRecords(MOCK_OPPORTUNITIES, { pageSize: 50 }, ctx());
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((i) => i.source.url.startsWith("https://"))).toBe(true);
    expect(mockCards[0].source.url.startsWith("https://")).toBe(true);
  });

  it("con varias fuentes usa la URL de la primera", () => {
    const slug = "estado-joven-movilidad-ingenieria-civil";
    const record = MOCK_OPPORTUNITIES.find((o) => o.slug === slug)!;
    expect(record.sources.length).toBeGreaterThan(1);
    const r = searchRecords(MOCK_OPPORTUNITIES, { pageSize: 50 }, ctx());
    const card = r.items.find((i) => i.slug === slug)!;
    expect(card.source.url).toBe(record.sources[0].url);
    expect(card.source.url).not.toBe(record.applyUrl);
  });
});

describe("toCard / toDetail: organization.logoUrl", () => {
  const record = MOCK_OPPORTUNITIES[0];
  const withOrg = (org: { name: string; website?: string | null; logoUrl?: string | null }, clientId: string | null = "cid"): MapContext => ({
    ...ctx(),
    organizations: new Map([
      [record.organizationId, { id: record.organizationId, sector: "privado", logoUrl: null, ...org }],
    ]),
    brandfetchClientId: clientId,
  });

  it("los datos de prueba no tienen logo (organizaciones ficticias)", () => {
    const r = searchRecords(MOCK_OPPORTUNITIES, { pageSize: 50 }, { ...ctx(), brandfetchClientId: "cid" });
    expect(r.items.every((i) => i.organization.logoUrl === null)).toBe(true);
    expect(mockCards.every((c) => c.organization.logoUrl === null)).toBe(true);
  });

  it("arma el logo de Brandfetch desde el sitio web, en tarjeta y detalle", () => {
    const context = withOrg({ name: "Empresa Real", website: "empresareal.com.co" });
    const expected = brandfetchLogoUrl("empresareal.com.co", "cid");
    expect(toCard(record, context).organization.logoUrl).toBe(expected);
    expect(toDetail(record, context).organization.logoUrl).toBe(expected);
  });

  it("sin client ID o con una organización confidencial no hay logo", () => {
    expect(toCard(record, withOrg({ name: "Empresa Real", website: "empresareal.com.co" }, null)).organization.logoUrl).toBeNull();
    expect(
      toCard(record, withOrg({ name: "Empresa del sector (confidencial)", website: "empresareal.com.co" })).organization.logoUrl,
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { MOCK_OPPORTUNITIES, MOCK_ORGANIZATIONS, MOCK_SOURCES } from "@/lib/mocks/data";
import { mockCards } from "@/lib/mocks";
import { todayInBogota } from "@/lib/time";
import { searchRecords } from "@/server/search/engine";
import type { MapContext } from "./mappers";

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

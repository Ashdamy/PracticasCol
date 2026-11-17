import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HomeData } from "@/lib/contracts";
import { mockCards } from "@/lib/mocks";
import { HomeOpportunities } from "./home-opportunities";

function render(closingSoon: HomeData["closingSoon"], recent: HomeData["recent"]) {
  return renderToStaticMarkup(createElement(HomeOpportunities, {
    data: { closingSoon, recent, totals: { active: 23, sources: 4, organizations: 10 } },
  }));
}

describe("portada con datos del contrato", () => {
  it("muestra recientes sin fecha de cierre y omite todo el bloque de cierres", () => {
    const recent = mockCards.slice(0, 6).map(card => ({
      ...card, deadline: { type: "no_publicada" as const, date: null, daysLeft: null },
    }));
    const html = render([], recent);
    expect(html).toContain("Recién publicadas");
    expect(html).not.toContain("closing-soon-title");
    expect(html).not.toContain("Prácticas que cierran pronto");
    expect(html.match(/class="opportunity-card /g)).toHaveLength(6);
    expect(html).toContain('href="/practicas?orden=recientes"');
  });

  it("muestra ambos bloques y mantiene las seis recientes sin duplicados", () => {
    const html = render(mockCards.slice(0, 6), mockCards.slice(3, 9));
    expect(html).toContain("Prácticas que cierran pronto");
    expect(html).toContain("Recién publicadas");
    for (const card of mockCards.slice(0, 9)) {
      expect(html.split(`href="/practicas/${card.slug}"`).length - 1).toBe(1);
    }
  });

  it("si todas coinciden, las muestra en recientes sin un bloque vacío de cierres", () => {
    const cards = mockCards.slice(0, 6);
    const html = render(cards, cards);
    expect(html).not.toContain("closing-soon-title");
    expect(html.match(/class="opportunity-card /g)).toHaveLength(6);
  });

  it("si ambas listas están vacías, ofrece explorar prácticas sin listas vacías", () => {
    const html = render([], []);
    expect(html).toContain("Recién publicadas");
    expect(html).toContain("Todavía no hay prácticas para mostrar.");
    expect(html).toContain('href="/practicas"');
    expect(html).not.toContain("closing-soon-title");
    expect(html).not.toContain('class="opportunity-list"');
  });
});

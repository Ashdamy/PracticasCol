import { describe, expect, it } from "vitest";
import { MOCK_OPPORTUNITIES, MOCK_ORGANIZATIONS, MOCK_SOURCES } from "@/lib/mocks/data";
import { mockProfile } from "@/lib/mocks";
import { resolveProfile, type MapContext } from "@/server/domain/mappers";
import { todayInBogota } from "@/lib/time";
import type { StudentProfile } from "@/lib/contracts";
import { searchRecords } from "./engine";

function ctx(profile: StudentProfile | null = null): MapContext {
  const now = new Date();
  return {
    organizations: new Map(MOCK_ORGANIZATIONS.map((o) => [o.id, o])),
    sources: new Map(MOCK_SOURCES.map((s) => [s.id, s])),
    now,
    today: todayInBogota(now),
    profile: resolveProfile(profile),
  };
}

describe("searchRecords (mocks)", () => {
  it("excluye vencidas y retiradas", () => {
    const r = searchRecords(MOCK_OPPORTUNITIES, { pageSize: 50 }, ctx());
    const slugs = r.items.map((i) => i.slug);
    expect(slugs).not.toContain("retirada-ejemplo");
    expect(slugs).not.toContain("practica-comunicacion-servicios-publicos-valle");
    expect(r.items.every((i) => i.deadline.daysLeft === null || i.deadline.daysLeft >= 0)).toBe(true);
  });

  it("búsqueda de texto sin tildes y con plurales", () => {
    const r = searchRecords(MOCK_OPPORTUNITIES, { q: "ingenieria electronica" }, ctx());
    expect(r.items[0]?.slug).toBe("practica-ingenieria-electronica-servicios-publicos-valle");
    const plural = searchRecords(MOCK_OPPORTUNITIES, { q: "pasantias" }, ctx());
    expect(plural.total).toBeGreaterThan(0);
    expect(plural.items.every((i) => i.type === "pasantia" || /pasant/i.test(i.title))).toBe(true);
    expect(searchRecords(MOCK_OPPORTUNITIES, { q: "PSICOLOGÍA" }, ctx()).total).toBeGreaterThan(0);
  });

  it("filtro de municipio incluye remotas", () => {
    const r = searchRecords(MOCK_OPPORTUNITIES, { municipalities: ["barbosa"], pageSize: 50 }, ctx());
    expect(r.items.some((i) => i.municipality?.slug === "barbosa")).toBe(true);
    expect(r.items.some((i) => i.modality === "remota")).toBe(true);
    expect(r.items.every((i) => i.modality === "remota" || i.municipality?.slug === "barbosa")).toBe(true);
  });

  it("facetas ignoran su propio filtro", () => {
    const r = searchRecords(MOCK_OPPORTUNITIES, { types: ["pasantia"] }, ctx());
    const practicas = r.facets.types.find((f) => f.value === "practica_profesional")!;
    expect(practicas.count).toBeGreaterThan(0);
    expect(r.items.every((i) => i.type === "pasantia")).toBe(true);
  });

  it("eligibleOnly con perfil excluye no_cumple y ordena 'cumple' primero", () => {
    const r = searchRecords(MOCK_OPPORTUNITIES, { eligibleOnly: true, pageSize: 50 }, ctx(mockProfile));
    expect(r.appliedProfile).toBe(true);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((i) => i.eligibility?.verdict !== "no_cumple")).toBe(true);
    expect(r.items[0].eligibility?.verdict).toBe("cumple");
  });

  it("eligibleOnly sin perfil se ignora", () => {
    const all = searchRecords(MOCK_OPPORTUNITIES, {}, ctx()).total;
    const r = searchRecords(MOCK_OPPORTUNITIES, { eligibleOnly: true }, ctx());
    expect(r.appliedProfile).toBe(false);
    expect(r.total).toBe(all);
  });

  it("orden por cierre: primero las que cierran antes, sin fecha al final", () => {
    const r = searchRecords(MOCK_OPPORTUNITIES, { sort: "cierre", pageSize: 50 }, ctx());
    const days = r.items.map((i) => i.deadline.daysLeft);
    const withDate = days.filter((x): x is number => x !== null);
    expect(withDate).toEqual([...withDate].sort((a, b) => a - b));
    expect(days.slice(withDate.length).every((x) => x === null)).toBe(true);
  });

  it("paginación", () => {
    const r = searchRecords(MOCK_OPPORTUNITIES, { pageSize: 5, page: 2 }, ctx());
    expect(r.items).toHaveLength(5);
    expect(r.page).toBe(2);
    expect(r.totalPages).toBe(Math.ceil(r.total / 5));
  });

  it("solo remuneradas", () => {
    const r = searchRecords(MOCK_OPPORTUNITIES, { paidOnly: true, pageSize: 50 }, ctx());
    expect(r.items.every((i) => ["salario", "apoyo_sostenimiento", "auxilio"].includes(i.compensation.type))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { JOOBLE_SOURCE_ID } from "../adapters/jooble";
import { findMissingFromAggregators, type MissingTarget } from "./retire-missing";

const JOOBLE = { sourceId: JOOBLE_SOURCE_ID, url: "https://co.jooble.org/jdp/1" };
const MANUAL = { sourceId: "src-manual", url: "https://empresa.com/oferta" };

let n = 0;
function opp(lastVerifiedAt: string, overrides: Partial<MissingTarget> = {}): MissingTarget {
  n += 1;
  return { id: `opp-${n}`, title: `Practicante ${n}`, status: "publicada", sources: [JOOBLE], lastVerifiedAt, ...overrides };
}

describe("findMissingFromAggregators", () => {
  it("vence las publicadas que llevan 7 días sin aparecer, contados desde la última corrida", () => {
    const fresh = opp("2026-11-20T06:00:00Z");
    const sixDays = opp("2026-11-14T07:00:00Z");
    const eightDays = opp("2026-11-12T06:00:00Z");
    const { decisions, lastRunBySource } = findMissingFromAggregators([fresh, sixDays, eightDays]);
    expect(lastRunBySource.get(JOOBLE_SOURCE_ID)).toBe("2026-11-20T06:00:00Z");
    expect(decisions.map((d) => [d.opportunity.id, d.newStatus, d.daysMissing])).toEqual([[eightDays.id, "vencida", 8]]);
  });

  it("si la ingesta dejó de correr, no retira nada (se cuenta desde la última corrida, no desde hoy)", () => {
    const all = [opp("2026-10-01T06:00:00Z"), opp("2026-10-01T06:00:00Z")];
    expect(findMissingFromAggregators(all).decisions).toEqual([]);
  });

  it("las que estaban en revisión se retiran (nunca se mostraron)", () => {
    const pending = opp("2026-11-01T06:00:00Z", { status: "en_revision" });
    const { decisions } = findMissingFromAggregators([opp("2026-11-20T06:00:00Z"), pending]);
    expect(decisions.map((d) => d.newStatus)).toEqual(["retirada"]);
  });

  it("no toca las que también llegaron por otra fuente, ni las ya vencidas o retiradas", () => {
    const mixed = opp("2026-11-01T06:00:00Z", { sources: [JOOBLE, MANUAL] });
    const onlyManual = opp("2026-11-01T06:00:00Z", { sources: [MANUAL] });
    const expired = opp("2026-11-01T06:00:00Z", { status: "vencida" });
    const retired = opp("2026-11-01T06:00:00Z", { status: "retirada" });
    const { decisions } = findMissingFromAggregators([opp("2026-11-20T06:00:00Z"), mixed, onlyManual, expired, retired]);
    expect(decisions).toEqual([]);
  });

  it("acepta otro número de días", () => {
    const threeDays = opp("2026-11-17T06:00:00Z");
    expect(findMissingFromAggregators([opp("2026-11-20T06:00:00Z"), threeDays], { maxDays: 3 }).decisions).toHaveLength(1);
    expect(findMissingFromAggregators([opp("2026-11-20T06:00:00Z"), threeDays], { maxDays: 4 }).decisions).toHaveLength(0);
  });

  it("sin ofertas de agregadores no hay nada que hacer", () => {
    expect(findMissingFromAggregators([opp("2026-11-01T06:00:00Z", { sources: [MANUAL] })]).decisions).toEqual([]);
  });
});

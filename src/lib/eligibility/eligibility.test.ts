import { describe, expect, it } from "vitest";
import { evaluateEligibility, type EligibilityOpportunity, type EligibilityProfile } from "./index";

const TODAY = "2026-11-13";

const opp = (o: Partial<EligibilityOpportunity> = {}): EligibilityOpportunity => ({
  levels: ["universitario"],
  openToAllPrograms: false,
  programIds: ["prog-ing-industrial"],
  knowledgeAreaIds: [],
  programKnowledgeAreaIds: ["nbc-ing-industrial"],
  acceptsRelatedPrograms: false,
  semesterMin: 7,
  semesterMax: null,
  acceptsGraduates: null,
  institutionIds: null,
  deadline: { type: "fecha", date: "2026-11-20" },
  otherRequirements: [],
  ...o,
});

const student = (p: Partial<EligibilityProfile> = {}): EligibilityProfile => ({
  level: "universitario",
  institutionId: "inst-eafit",
  programId: "prog-ing-industrial",
  programKnowledgeAreaId: "nbc-ing-industrial",
  semester: 8,
  isGraduate: false,
  ...p,
});

const statusOf = (r: ReturnType<typeof evaluateEligibility>, criterion: string) =>
  r.checks.find((c) => c.criterion === criterion)?.status;

describe("evaluateEligibility", () => {
  it("sin perfil → sin_perfil", () => {
    expect(evaluateEligibility(opp(), null, TODAY)).toEqual({ verdict: "sin_perfil", checks: [] });
  });

  it("todo coincide → cumple", () => {
    const r = evaluateEligibility(opp(), student(), TODAY);
    expect(r.verdict).toBe("cumple");
    expect(r.checks.every((c) => c.status === "cumple")).toBe(true);
  });

  it("nivel distinto → no_cumple", () => {
    const r = evaluateEligibility(opp({ levels: ["tecnologo"] }), student(), TODAY);
    expect(r.verdict).toBe("no_cumple");
    expect(statusOf(r, "nivel")).toBe("no_cumple");
  });

  it("nivel no especificado → revisar (nunca no_cumple)", () => {
    const r = evaluateEligibility(opp({ levels: [] }), student(), TODAY);
    expect(r.verdict).toBe("revisar");
    expect(statusOf(r, "nivel")).toBe("desconocido");
  });

  it("programa afín del mismo NBC → verificar / revisar", () => {
    const r = evaluateEligibility(
      opp({ acceptsRelatedPrograms: true }),
      student({ programId: "prog-ing-produccion" }),
      TODAY,
    );
    expect(statusOf(r, "programa")).toBe("verificar");
    expect(r.verdict).toBe("revisar");
  });

  it("programa de otra área sin 'afines' → no_cumple", () => {
    const r = evaluateEligibility(
      opp(),
      student({ programId: "prog-psicologia", programKnowledgeAreaId: "nbc-psicologia" }),
      TODAY,
    );
    expect(statusOf(r, "programa")).toBe("no_cumple");
  });

  it("área aceptada explícitamente → cumple", () => {
    const r = evaluateEligibility(
      opp({ programIds: [], programKnowledgeAreaIds: [], knowledgeAreaIds: ["nbc-ing-industrial"] }),
      student({ programId: "prog-ing-produccion" }),
      TODAY,
    );
    expect(statusOf(r, "programa")).toBe("cumple");
  });

  it("abierta a cualquier programa → cumple", () => {
    const r = evaluateEligibility(
      opp({ openToAllPrograms: true, programIds: [] }),
      student({ programId: "prog-derecho", programKnowledgeAreaId: "nbc-derecho" }),
      TODAY,
    );
    expect(statusOf(r, "programa")).toBe("cumple");
  });

  it("programa no catalogado en el perfil → desconocido", () => {
    const r = evaluateEligibility(opp(), student({ programId: "x", programKnowledgeAreaId: null }), TODAY);
    expect(statusOf(r, "programa")).toBe("desconocido");
    expect(r.verdict).toBe("revisar");
  });

  it("semestre bajo el mínimo → no_cumple con mensaje claro", () => {
    const r = evaluateEligibility(opp(), student({ semester: 5 }), TODAY);
    const c = r.checks.find((x) => x.criterion === "semestre")!;
    expect(c.status).toBe("no_cumple");
    expect(c.message).toContain("7.º");
  });

  it("semestre sin indicar en el perfil → desconocido, sigue 'cumple' si nivel y programa cumplen", () => {
    const r = evaluateEligibility(opp(), student({ semester: null }), TODAY);
    expect(statusOf(r, "semestre")).toBe("desconocido");
    expect(r.verdict).toBe("cumple");
  });

  it("egresado: depende de acceptsGraduates", () => {
    expect(statusOf(evaluateEligibility(opp({ acceptsGraduates: true }), student({ isGraduate: true }), TODAY), "semestre")).toBe("cumple");
    expect(statusOf(evaluateEligibility(opp({ acceptsGraduates: false }), student({ isGraduate: true }), TODAY), "semestre")).toBe("no_cumple");
    expect(statusOf(evaluateEligibility(opp({ acceptsGraduates: null }), student({ isGraduate: true }), TODAY), "semestre")).toBe("verificar");
  });

  it("exclusiva de otra institución → no_cumple", () => {
    const r = evaluateEligibility(opp({ institutionIds: ["inst-udea"] }), student(), TODAY);
    expect(statusOf(r, "institucion")).toBe("no_cumple");
    expect(r.verdict).toBe("no_cumple");
  });

  it("fecha límite: hoy abierta, ayer cerrada, sin fecha desconocida", () => {
    expect(evaluateEligibility(opp({ deadline: { type: "fecha", date: TODAY } }), student(), TODAY).checks
      .find((c) => c.criterion === "fecha_limite")?.message).toBe("Cierra hoy.");
    expect(statusOf(evaluateEligibility(opp({ deadline: { type: "fecha", date: "2026-11-12" } }), student(), TODAY), "fecha_limite")).toBe("no_cumple");
    expect(statusOf(evaluateEligibility(opp({ deadline: { type: "no_publicada", date: null } }), student(), TODAY), "fecha_limite")).toBe("desconocido");
    expect(statusOf(evaluateEligibility(opp({ deadline: { type: "hasta_agotar_cupos", date: null } }), student(), TODAY), "fecha_limite")).toBe("verificar");
  });

  it("requisitos en texto libre → check 'otros' en verificar", () => {
    const r = evaluateEligibility(opp({ otherRequirements: ["Inglés B1"] }), student(), TODAY);
    expect(statusOf(r, "otros")).toBe("verificar");
    expect(r.verdict).toBe("cumple");
  });
});

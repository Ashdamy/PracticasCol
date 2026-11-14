import { describe, expect, it } from "vitest";
import { dedupeHash, findDuplicate, normalizeOrganization, trigramSimilarity } from "./dedupe";

describe("dedupeHash", () => {
  it("es un sha256 estable", () => {
    const hash = dedupeHash("Textiles Aburrá S.A.S.", "Practicante de Ingeniería Industrial", "2026-12-15");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(dedupeHash("Textiles Aburrá S.A.S.", "Practicante de Ingeniería Industrial", "2026-12-15")).toBe(hash);
  });

  it("ignora tildes, mayúsculas, espacios, stopwords y sufijos societarios", () => {
    const a = dedupeHash("Textiles Aburrá S.A.S.", "Practicante de Ingeniería Industrial", "2026-12-15");
    expect(dedupeHash("  TEXTILES   ABURRA sas ", "practicante  ingenieria industrial", "2026-12-15")).toBe(a);
    expect(dedupeHash("Textiles Aburrá", "Practicante para la Ingeniería Industrial", "2026-12-15")).toBe(a);
  });

  it("cambia con la organización, el título o la fecha", () => {
    const a = dedupeHash("Textiles Aburrá", "Practicante de Ingeniería Industrial", "2026-12-15");
    expect(dedupeHash("Banco Montaña", "Practicante de Ingeniería Industrial", "2026-12-15")).not.toBe(a);
    expect(dedupeHash("Textiles Aburrá", "Practicante de Ingeniería Civil", "2026-12-15")).not.toBe(a);
    expect(dedupeHash("Textiles Aburrá", "Practicante de Ingeniería Industrial", "2026-12-16")).not.toBe(a);
    expect(dedupeHash("Textiles Aburrá", "Practicante de Ingeniería Industrial", null)).not.toBe(a);
  });
});

describe("normalizeOrganization", () => {
  it("quita sufijos societarios solo al final", () => {
    expect(normalizeOrganization("Alimentos Los Montes S.A.")).toBe("alimentos los montes");
    expect(normalizeOrganization("Comercializadora Ficticia, Ltda.")).toBe("comercializadora ficticia");
    expect(normalizeOrganization("SAS Institute")).toBe("sas institute");
  });
});

describe("trigramSimilarity", () => {
  it("1 para textos iguales (tras normalizar) y 0 para vacíos o sin nada en común", () => {
    expect(trigramSimilarity("Práctica de Mercadeo", "practica de mercadeo")).toBe(1);
    expect(trigramSimilarity("", "algo")).toBe(0);
    expect(trigramSimilarity("abc", "xyz")).toBe(0);
  });

  it("es simétrica y crece con el parecido", () => {
    const close = trigramSimilarity("Practicante de Ingeniería Industrial", "Practicante Ingeniería Industrial 2026");
    const far = trigramSimilarity("Practicante de Ingeniería Industrial", "Auxiliar contable");
    expect(close).toBeGreaterThan(0.7);
    expect(far).toBeLessThan(0.2);
    expect(trigramSimilarity("Auxiliar contable", "Practicante de Ingeniería Industrial")).toBe(far);
  });
});

describe("findDuplicate", () => {
  const existing = [
    { id: "a", organizationName: "Textiles Aburrá S.A.S.", title: "Practicante de Ingeniería Industrial – Mejora de procesos", deadlineDate: "2026-12-15" },
    { id: "b", organizationName: "Banco Montaña", title: "Practicante de Contaduría Pública", deadlineDate: null },
  ];

  it("mismo hash → exacto", () => {
    const found = findDuplicate(
      { organizationName: "TEXTILES ABURRA", title: "Practicante de ingeniería industrial - mejora de procesos", deadlineDate: "2026-12-15" },
      existing,
    );
    expect(found).toMatchObject({ kind: "exacto", match: { id: "a" }, similarity: 1 });
  });

  it("misma organización, título parecido y misma fecha → probable", () => {
    const found = findDuplicate(
      { organizationName: "Textiles Aburrá", title: "Practicante de Ingeniería Industrial: mejora de proceso 2026", deadlineDate: "2026-12-15" },
      existing,
    );
    expect(found?.kind).toBe("probable");
    expect(found?.match.id).toBe("a");
    expect(found?.similarity).toBeGreaterThanOrEqual(0.8);
  });

  it("una fecha faltante no impide el duplicado probable", () => {
    const found = findDuplicate(
      { organizationName: "Banco Montaña S.A.", title: "Practicante en Contaduría Pública", deadlineDate: "2026-12-01" },
      existing,
    );
    expect(found).toMatchObject({ kind: "probable", match: { id: "b" } });
  });

  it("fechas distintas, otra organización o título distinto → no es duplicado", () => {
    expect(
      findDuplicate(
        { organizationName: "Textiles Aburrá", title: "Practicante de Ingeniería Industrial – Mejora de procesos", deadlineDate: "2027-06-15" },
        existing,
      ),
    ).toBeNull();
    expect(
      findDuplicate(
        { organizationName: "Otra Empresa", title: "Practicante de Ingeniería Industrial – Mejora de proceso", deadlineDate: "2026-12-15" },
        existing,
      ),
    ).toBeNull();
    expect(
      findDuplicate({ organizationName: "Textiles Aburrá", title: "Auxiliar de bodega", deadlineDate: "2026-12-15" }, existing),
    ).toBeNull();
    expect(findDuplicate({ organizationName: "Textiles Aburrá", title: "Lo que sea", deadlineDate: null }, [])).toBeNull();
  });
});

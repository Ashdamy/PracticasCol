import { describe, expect, it } from "vitest";
import { companyWebsiteFromUrls, isNonCompanyDomain } from "./organization-website";

describe("isNonCompanyDomain", () => {
  it("reconoce portales, ATS, formularios y sus subdominios", () => {
    for (const domain of [
      "computrabajo.com",
      "co.computrabajo.com",
      "magneto365.com",
      "co.jooble.org",
      "elempleo.com",
      "co.indeed.com",
      "linkedin.com",
      "trabajosdiarios.co",
      "boards.greenhouse.io",
      "jobs.lever.co",
      "jobs.smartrecruiters.com",
      "empresa.wd3.myworkdayjobs.com",
      "career5.successfactors.eu",
      "docs.google.com",
      "forms.gle",
      "empresa.wordpress.com",
      "example.com",
      "bolsa.eafit.edu.co",
      "agenciapublicadeempleo.sena.edu.co",
    ]) {
      expect(isNonCompanyDomain(domain), domain).toBe(true);
    }
  });

  it("no confunde dominios propios parecidos", () => {
    for (const domain of ["bancolombia.com", "grupoexito.com.co", "milever.co", "notgoogle.com", "educa.com.co"]) {
      expect(isNonCompanyDomain(domain), domain).toBe(false);
    }
  });
});

describe("companyWebsiteFromUrls", () => {
  it("toma el dominio del enlace de postulación cuando es propio", () => {
    expect(companyWebsiteFromUrls("Bancolombia", ["https://www.bancolombia.com/empleo/practicas?id=3"])).toBe(
      "bancolombia.com",
    );
  });

  it("si la postulación es un portal, prueba con la fuente", () => {
    expect(
      companyWebsiteFromUrls("Postobón S.A.", ["https://co.computrabajo.com/oferta/1", "https://www.postobon.com/trabaja"]),
    ).toBe("postobon.com");
  });

  it("devuelve null si todos los enlaces son portales o inválidos", () => {
    expect(companyWebsiteFromUrls("Org", ["https://co.computrabajo.com/x", "https://www.magneto365.com/y"])).toBeNull();
    expect(companyWebsiteFromUrls("Org", ["", null, undefined, "no es un enlace"])).toBeNull();
    expect(companyWebsiteFromUrls("Org", [])).toBeNull();
  });

  it("nunca para confidenciales, agencias ni organizaciones sin nombre", () => {
    expect(companyWebsiteFromUrls("Empresa de retail (confidencial)", ["https://agencia.com.co/oferta"])).toBeNull();
    expect(companyWebsiteFromUrls("Agencia XYZ (empresa cliente)", ["https://agencia.com.co/oferta"])).toBeNull();
    expect(companyWebsiteFromUrls("  ", ["https://empresa.com.co"])).toBeNull();
  });
});

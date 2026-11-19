/**
 * Sitio web de una organización nueva, deducido del enlace de la convocatoria (función pura).
 * Si el enlace de postulación (o el de la fuente) está en el dominio propio de la empresa, ese dominio sirve
 * para pedir su logo (`src/server/domain/logos.ts`). Si está en un portal de empleo, un ATS, una red social,
 * un formulario o un acortador, no dice nada sobre la empresa y se descarta.
 */
import { isLogoExcluded, websiteDomain } from "@/server/domain/logos";

/**
 * Dominios que NO son el sitio de la empresa. Se compara el dominio completo y cualquier subdominio
 * (`co.computrabajo.com` coincide con `computrabajo.com`).
 */
export const NON_COMPANY_DOMAINS: readonly string[] = [
  // Portales de empleo y agregadores
  "computrabajo.com",
  "magneto365.com",
  "jooble.org",
  "elempleo.com",
  "indeed.com",
  "linkedin.com",
  "trabajosdiarios.com",
  "trabajosdiarios.co",
  "opcionempleo.com.co",
  "jobrapido.com",
  "jobleads.com",
  "talent.com",
  "glassdoor.com",
  "glassdoor.com.co",
  "bebee.com",
  "getonbrd.com",
  "torre.ai",
  "ticjob.co",
  "empleate.com",
  "acciontrabajo.com.co",
  "mitula.com.co",
  "trovit.com.co",
  "un-mejor-empleo.com",
  "unmejorempleo.com.co",
  "hoytrabajas.com",
  "simplyhired.com",
  "bumeran.com",
  "zonajobs.com",
  "buscojobs.com.co",
  "infojobs.net",
  "firstjob.me",
  "pandape.com",
  // Servicios públicos de empleo y bolsas institucionales
  "serviciodeempleo.gov.co",
  "buscadordeempleo.gov.co",
  "sena.edu.co",
  "comfama.com",
  "comfenalcoantioquia.com.co",
  "comfenalcoantioquia.com",
  // ATS y plataformas de selección
  "greenhouse.io",
  "lever.co",
  "smartrecruiters.com",
  "myworkdayjobs.com",
  "workday.com",
  "successfactors.com",
  "successfactors.eu",
  "sapsf.com",
  "ashbyhq.com",
  "workable.com",
  "bamboohr.com",
  "teamtailor.com",
  "recruitee.com",
  "breezy.hr",
  "jobvite.com",
  "icims.com",
  "taleo.net",
  "oraclecloud.com",
  "hiringroom.com",
  "buk.co",
  "evaluar.com",
  "psigmacorp.com",
  "zohorecruit.com",
  "factorialhr.com",
  "hirehive.com",
  // Formularios, documentos, acortadores y constructores de sitios
  "google.com",
  "forms.gle",
  "goo.gl",
  "office.com",
  "microsoft.com",
  "typeform.com",
  "jotform.com",
  "airtable.com",
  "notion.site",
  "notion.so",
  "bit.ly",
  "tinyurl.com",
  "cutt.ly",
  "t.co",
  "linktr.ee",
  "wordpress.com",
  "blogspot.com",
  "wixsite.com",
  "wix.com",
  "canva.com",
  "github.io",
  // Redes sociales y mensajería
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "whatsapp.com",
  "wa.me",
  "t.me",
  // Dominios de ejemplo (datos de prueba)
  "example.com",
  "example.org",
  "example.net",
];

/** Bolsas de empleo de instituciones educativas: publican ofertas de terceros. */
const EDUCATION_SUFFIX = /\.edu(\.[a-z]{2})?$/;

export function isNonCompanyDomain(domain: string): boolean {
  return (
    EDUCATION_SUFFIX.test(domain) ||
    NON_COMPANY_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))
  );
}

/**
 * Primer dominio propio entre los enlaces dados (en orden: postulación y luego fuente).
 * `null` si todos son portales, no hay enlaces válidos o la organización nunca lleva logo
 * (confidenciales y agencias: el enlace sería de la agencia, no de la empresa).
 */
export function companyWebsiteFromUrls(
  organizationName: string,
  urls: readonly (string | null | undefined)[],
): string | null {
  if (!organizationName.trim() || isLogoExcluded(organizationName)) return null;
  for (const url of urls) {
    const domain = websiteDomain(url);
    if (domain && !isNonCompanyDomain(domain)) return domain;
  }
  return null;
}

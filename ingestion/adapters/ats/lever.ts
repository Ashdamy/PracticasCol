/**
 * Conector de Lever (API pública de vacantes).
 *   GET https://api.lever.co/v0/postings/{company}?mode=json
 * Su robots.txt permite todo con `Crawl-delay: 1`; `ctx.http` aplica igual su pausa mínima de 2 s por host.
 */
import type { OpportunityDraft, RawItem, SourceAdapter } from "../../types";
import {
  asPosting,
  compileCountries,
  describeStats,
  htmlToText,
  isInternshipTitle,
  isRecord,
  list,
  listItems,
  makeExcerpt,
  makeLevelHint,
  parseJsonResponse,
  pickLocation,
  pickRequirements,
  postingToDraft,
  str,
  type AtsAdapterConfig,
  type AtsPosting,
  type FilterStats,
} from "./common";

export const LEVER_API = "https://api.lever.co/v0/postings";

export function leverPostingsUrl(company: string): string {
  return `${LEVER_API}/${encodeURIComponent(company)}?mode=json`;
}

/** Títulos de lista que claramente son requisitos (no beneficios ni responsabilidades). */
const REQUIREMENTS_LIST_RE =
  /\b(requirements?|qualifications?|requisitos?|what you(?:'|’)?ll need|what we(?:'|’)?re looking for|who you are|must haves?|perfil|lo que buscamos|que buscamos)\b/i;

/** `createdAt` llega en milisegundos desde 1970. */
export function leverEpochToIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * `salaryRange` → texto para el normalizador de pago. Solo se pasa el monto si está en pesos y por mes;
 * en otra moneda o periodo se dice que es remunerada sin cifra, para no guardar un valor mal convertido.
 */
export function leverSalaryText(range: unknown): string | null {
  if (!isRecord(range)) return null;
  const min = typeof range.min === "number" && range.min > 0 ? range.min : null;
  const max = typeof range.max === "number" && range.max > 0 ? range.max : null;
  if (min === null && max === null) return null;
  const currency = (str(range.currency) ?? "").toUpperCase();
  const interval = (str(range.interval) ?? "").toLowerCase();
  if (currency === "COP" && interval.includes("month")) {
    const low = Math.round(min ?? max ?? 0);
    const high = Math.round(max ?? min ?? 0);
    return low === high ? `Salario ${low} COP al mes` : `Salario desde ${low} hasta ${high} COP al mes`;
  }
  const period = interval.includes("year") ? "por año" : interval.includes("hour") ? "por hora" : "sin periodo claro";
  return `Remunerada (rango publicado en ${currency || "moneda no indicada"}, ${period}; ver la convocatoria)`;
}

function requirementsFrom(lists: unknown): string[] {
  for (const entry of list(lists)) {
    if (!isRecord(entry)) continue;
    const heading = str(entry.text);
    const content = typeof entry.content === "string" ? entry.content : null;
    if (heading && content && REQUIREMENTS_LIST_RE.test(heading)) return pickRequirements(listItems(content));
  }
  return [];
}

/** Vacante de Lever → ficha propia. Devuelve `null` si no pasa el filtro o le faltan datos básicos. */
export function leverPostingToPosting(
  item: unknown,
  config: AtsAdapterConfig,
  countries: readonly RegExp[],
): { posting: AtsPosting | null; inCountry: boolean } {
  if (!isRecord(item)) return { posting: null, inCountry: false };
  const title = str(item.text);
  const url = str(item.hostedUrl);
  const id = str(item.id);
  const categories = isRecord(item.categories) ? item.categories : {};

  const mainLocation = str(categories.location);
  const location = pickLocation(
    [
      mainLocation,
      ...list(categories.allLocations).map(str),
      // Lever también trae el país como código ISO: "Bogotá" + "CO" es Colombia aunque el texto no lo diga.
      str(item.country)?.toUpperCase() === "CO" ? `${mainLocation ?? ""}, Colombia`.replace(/^, /, "") : null,
    ],
    countries,
  );
  const inCountry = location !== null;
  if (!location || !title || !url || !id) return { posting: null, inCountry };
  if (config.filter.onlyInternships && !isInternshipTitle(title)) return { posting: null, inCountry };

  const plainText =
    typeof item.descriptionPlain === "string" && item.descriptionPlain.trim() !== ""
      ? htmlToText(item.descriptionPlain)
      : typeof item.description === "string"
        ? htmlToText(item.description)
        : "";
  const workplaceType = str(item.workplaceType);

  return {
    inCountry,
    posting: {
      provider: "lever",
      id,
      title,
      location,
      workplaceType: workplaceType && workplaceType.toLowerCase() !== "unspecified" ? workplaceType : null,
      commitment: str(categories.commitment),
      department: str(categories.department) ?? str(categories.team),
      url,
      applyUrl: str(item.applyUrl) ?? url,
      postedAt: leverEpochToIso(item.createdAt),
      updatedAt: null,
      excerpt: makeExcerpt(plainText),
      levelHint: makeLevelHint(title, plainText),
      requirements: requirementsFrom(item.lists),
      compensation: leverSalaryText(item.salaryRange),
    },
  };
}

export function createLeverAdapter(config: AtsAdapterConfig): SourceAdapter {
  const countries = compileCountries(config.filter.countries);
  const postingsUrl = leverPostingsUrl(config.token);

  return {
    id: config.id,
    name: config.name,
    method: "api",
    autoPublish: false,

    async fetch(ctx): Promise<RawItem[]> {
      const body = parseJsonResponse(await ctx.http.get(postingsUrl), postingsUrl);
      if (!Array.isArray(body)) throw new Error(`Lever cambió el formato de ${postingsUrl}: no es una lista`);
      const fetchedAt = ctx.now.toISOString();
      const stats: FilterStats = { total: body.length, inCountry: 0, kept: 0 };
      const items: RawItem[] = [];
      for (const item of body) {
        const { posting, inCountry } = leverPostingToPosting(item, config, countries);
        if (inCountry) stats.inCountry += 1;
        if (!posting) continue;
        stats.kept += 1;
        items.push({ sourceId: config.id, externalId: posting.id, url: posting.url, payload: posting, fetchedAt });
      }
      ctx.log.info(describeStats(config, stats));
      return items;
    },

    parse(raw): OpportunityDraft {
      return postingToDraft(asPosting(raw.payload), config.organizationName);
    },
  };
}

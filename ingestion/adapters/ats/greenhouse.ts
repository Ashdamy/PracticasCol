/**
 * Conector de Greenhouse (API pública de tableros de empleo).
 *   GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 * Su robots.txt solo prohíbe /embed/. Toda descarga pasa por `ctx.http` (robots.txt + pausa por host).
 */
import type { OpportunityDraft, RawItem, SourceAdapter } from "../../types";
import {
  asPosting,
  compileCountries,
  decodeEntities,
  describeStats,
  htmlToText,
  isInternshipTitle,
  isRecord,
  list,
  makeExcerpt,
  makeLevelHint,
  parseJsonResponse,
  pickLocation,
  postingToDraft,
  str,
  type AtsAdapterConfig,
  type AtsPosting,
  type FilterStats,
} from "./common";

export const GREENHOUSE_API = "https://boards-api.greenhouse.io/v1/boards";

export function greenhouseBoardUrl(token: string): string {
  return `${GREENHOUSE_API}/${encodeURIComponent(token)}/jobs?content=true`;
}

/** Campos de `metadata` que describen la oferta. Cualquier otro (p. ej. quién recluta) se ignora. */
const WORKPLACE_METADATA_RE = /\b(workplace|work ?place type|work model|work arrangement|modalidad|remote)\b/i;
const COMMITMENT_METADATA_RE = /\b(employment type|time type|commitment|tipo de contrato|jornada)\b/i;

function metadataValue(metadata: unknown, nameRe: RegExp): string | null {
  for (const entry of list(metadata)) {
    if (!isRecord(entry)) continue;
    const name = str(entry.name);
    if (!name || !nameRe.test(name)) continue;
    const value = Array.isArray(entry.value) ? str(entry.value.filter((v) => typeof v === "string").join(", ")) : str(entry.value);
    if (value) return value;
  }
  return null;
}

/** `content` llega como HTML escapado (`&lt;p&gt;…`): se desescapa y se pasa a texto plano. */
export function greenhouseContentToText(content: string | null): string {
  return content ? htmlToText(decodeEntities(content)) : "";
}

/**
 * Oferta de Greenhouse → ficha propia. Devuelve `null` si no pasa el filtro o le faltan datos básicos.
 * `inCountry` se informa aparte para el log.
 */
export function greenhouseJobToPosting(
  job: unknown,
  config: AtsAdapterConfig,
  countries: readonly RegExp[],
): { posting: AtsPosting | null; inCountry: boolean } {
  if (!isRecord(job)) return { posting: null, inCountry: false };
  const title = str(job.title);
  const url = str(job.absolute_url);
  const id = typeof job.id === "number" || typeof job.id === "string" ? String(job.id) : null;

  const offices = list(job.offices).filter(isRecord);
  const location = pickLocation(
    [
      isRecord(job.location) ? str(job.location.name) : null,
      ...offices.map((office) => str(office.location)),
      ...offices.map((office) => str(office.name)),
    ],
    countries,
  );
  const inCountry = location !== null;
  if (!location || !title || !url || !id) return { posting: null, inCountry };
  if (config.filter.onlyInternships && !isInternshipTitle(title)) return { posting: null, inCountry };

  const plainText = greenhouseContentToText(typeof job.content === "string" ? job.content : null);
  const departments = list(job.departments)
    .filter(isRecord)
    .map((department) => str(department.name))
    .filter((name): name is string => name !== null);

  return {
    inCountry,
    posting: {
      provider: "greenhouse",
      id,
      title,
      location,
      workplaceType: metadataValue(job.metadata, WORKPLACE_METADATA_RE),
      commitment: metadataValue(job.metadata, COMMITMENT_METADATA_RE),
      department: departments[0] ?? null,
      url,
      applyUrl: url,
      postedAt: null,
      updatedAt: str(job.updated_at),
      excerpt: makeExcerpt(plainText),
      levelHint: makeLevelHint(title, plainText),
      requirements: [],
      compensation: null,
    },
  };
}

export function createGreenhouseAdapter(config: AtsAdapterConfig): SourceAdapter {
  const countries = compileCountries(config.filter.countries);
  const boardUrl = greenhouseBoardUrl(config.token);

  return {
    id: config.id,
    name: config.name,
    method: "api",
    autoPublish: false,

    async fetch(ctx): Promise<RawItem[]> {
      const body = parseJsonResponse(await ctx.http.get(boardUrl), boardUrl);
      if (!isRecord(body) || !Array.isArray(body.jobs)) {
        throw new Error(`Greenhouse cambió el formato de ${boardUrl}: no hay lista «jobs»`);
      }
      const fetchedAt = ctx.now.toISOString();
      const stats: FilterStats = { total: body.jobs.length, inCountry: 0, kept: 0 };
      const items: RawItem[] = [];
      for (const job of body.jobs) {
        const { posting, inCountry } = greenhouseJobToPosting(job, config, countries);
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

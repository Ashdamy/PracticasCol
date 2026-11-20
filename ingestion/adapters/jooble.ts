/**
 * Conector de Jooble (API REST oficial para sitios aliados).
 *   POST https://co.jooble.org/api/{clave}   cuerpo JSON: { keywords, location, radius, page, ResultOnPage }
 * Documentación: https://jooblehelpcenter.freshdesk.com/en/support/solutions/articles/60001448238
 *
 * Reglas de esta fuente:
 * - Cada país tiene su propia clave: la de jooble.org solo trae empleos de EE. UU. Esta usa co.jooble.org.
 * - Plan gratuito: 100 consultas al día por clave (se reinicia a medianoche UTC). Cada corrida tiene un tope
 *   propio (`DEFAULT_MAX_REQUESTS`) muy por debajo, y un 429 detiene la corrida sin reintentar.
 * - La clave va en la ruta de la URL: NUNCA se escribe en logs, errores ni en los ítems crudos.
 * - El enlace de cada oferta es la página de Jooble (`link`), como pide el programa de aliados.
 * - Solo se guarda una ficha propia con campos de lista blanca y un extracto corto sin datos personales.
 * - Todo entra `en_revision` (`autoPublish: false`).
 *
 * `robots.txt` de co.jooble.org solo prohíbe `/employer/api`; igual se consulta antes de la primera petición.
 * El POST no pasa por `ingestion/http.ts` (que es solo GET, a propósito): va por `createJoobleTransport`, que
 * solo sabe hablar con la API de Jooble, sin cookies, con pausa de ≥ 2 s y sin seguir redirecciones.
 */
import { clean } from "../normalize/text";
import { normalizeModality } from "../normalize/modality";
import type { AdapterContext, OpportunityDraft, RawItem, SourceAdapter } from "../types";
import { defaultUserAgent } from "../http";
import {
  decodeEntities,
  htmlToText,
  isInternshipTitle,
  isRecord,
  list,
  makeExcerpt,
  makeLevelHint,
  matchesLocation,
  mentionsRemote,
  str,
  truncate,
} from "./ats/common";

export const JOOBLE_SOURCE_ID = "src-api-jooble-co";
export const JOOBLE_SOURCE_NAME = "Jooble Colombia";
export const JOOBLE_HOST = "co.jooble.org";
/** Límite del plan gratuito, por clave y por día. */
export const JOOBLE_DAILY_LIMIT = 100;
/** Tope por corrida: deja margen para pruebas y para una segunda corrida el mismo día. */
export const DEFAULT_MAX_REQUESTS = 30;
export const DEFAULT_PAGES_PER_QUERY = 2;
export const DEFAULT_RESULTS_PER_PAGE = 50;
const MIN_DELAY_MS = 2000;
const TIMEOUT_MS = 20_000;

/** Radios que acepta Jooble, en km. */
export type JoobleRadius = "0" | "4" | "8" | "16" | "26" | "40" | "80";

export interface JoobleQuery {
  keywords: string;
  location: string;
  radius?: JoobleRadius;
}

/**
 * Búsquedas por defecto: todas desde Medellín con radio de 40 km, que cubre los 10 municipios del Valle de
 * Aburrá y Rionegro. 11 búsquedas × 2 páginas = 22 consultas como máximo.
 */
export const DEFAULT_JOOBLE_QUERIES: readonly JoobleQuery[] = [
  "practicante",
  "practicas profesionales",
  "practica empresarial",
  "pasante",
  "pasantia",
  "aprendiz",
  "aprendiz sena",
  "contrato de aprendizaje",
  "estudiante en practica",
  "trainee",
  "becario",
].map((keywords) => ({ keywords, location: "Medellín", radius: "40" }));

// ---------------------------------------------------------------------------
// Transporte (la única pieza con red)
// ---------------------------------------------------------------------------

export interface JoobleRequestBody {
  keywords: string;
  location: string;
  radius?: JoobleRadius;
  page: string;
  ResultOnPage?: string;
}

export interface JoobleResponse {
  status: number;
  text: string;
}

export interface JoobleTransport {
  post(body: JoobleRequestBody): Promise<JoobleResponse>;
}

export interface JoobleTransportOptions {
  apiKey: string;
  host?: string;
  fetchImpl?: typeof fetch;
  userAgent?: string;
  minDelayMs?: number;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Quita la clave de cualquier texto que vaya a un log o a un error. */
export function redactKey(text: string, apiKey: string): string {
  if (!apiKey) return text;
  return text.split(apiKey).join("<clave>").split(encodeURIComponent(apiKey)).join("<clave>");
}

export function createJoobleTransport(options: JoobleTransportOptions): JoobleTransport {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error("Falta JOOBLE_API_KEY");
  const host = options.host ?? JOOBLE_HOST;
  const endpoint = `https://${host}/api/${encodeURIComponent(apiKey)}`;
  const fetchImpl = options.fetchImpl ?? fetch;
  const userAgent = options.userAgent ?? defaultUserAgent();
  const minDelayMs = Math.max(MIN_DELAY_MS, options.minDelayMs ?? MIN_DELAY_MS);
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastRequestAt: number | null = null;

  return {
    async post(body) {
      if (lastRequestAt !== null) {
        const wait = lastRequestAt + minDelayMs - now();
        if (wait > 0) await sleep(wait);
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": userAgent },
          body: JSON.stringify(body),
          credentials: "omit",
          redirect: "manual",
          signal: controller.signal,
        });
        return { status: response.status, text: await response.text() };
      } catch (error) {
        if (controller.signal.aborted) throw new Error(`La API de Jooble no respondió en ${timeoutMs} ms`);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`No se pudo consultar la API de Jooble: ${redactKey(message, apiKey)}`);
      } finally {
        clearTimeout(timer);
        lastRequestAt = now();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Ficha propia (lo único que se guarda como crudo)
// ---------------------------------------------------------------------------

export interface JooblePosting {
  provider: "jooble";
  id: string;
  title: string;
  company: string | null;
  location: string;
  salary: string | null;
  /** "Tiempo completo", "Medio tiempo"… tal como lo dice Jooble. */
  employmentType: string | null;
  /** Página de la oferta en Jooble. */
  url: string;
  excerpt: string;
  levelHint: string;
  /** Texto para el normalizador de modalidad, solo si el título o el extracto la mencionan. */
  modalityHint: string | null;
}

export type JoobleSkipReason = "formato" | "no_es_practica" | "fuera_de_cobertura";

const MUNICIPALITIES_ONLY: readonly RegExp[] = [];
const COLOMBIA_RE = /\bcolombia\b/;

function httpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** El snippet de Jooble trae etiquetas como `<b>` y entidades: se pasa a texto plano. */
export function snippetToText(snippet: string | null): string {
  return snippet ? htmlToText(decodeEntities(snippet)) : "";
}

/**
 * Oferta de Jooble → ficha propia, o el motivo por el que se descarta:
 * - `no_es_practica`: el título no habla de práctica, pasantía, aprendiz, trainee…
 * - `fuera_de_cobertura`: no es de un municipio del catálogo ni remota en Colombia.
 */
export function joobleJobToPosting(job: unknown): { posting: JooblePosting } | { skip: JoobleSkipReason } {
  if (!isRecord(job)) return { skip: "formato" };
  const id = typeof job.id === "number" || typeof job.id === "string" ? String(job.id) : null;
  const title = str(job.title) ? decodeEntities(str(job.title)!) : null;
  const url = httpUrl(str(job.link));
  if (!id || !title || !url) return { skip: "formato" };
  if (!isInternshipTitle(title)) return { skip: "no_es_practica" };

  const location = str(job.location) ?? "";
  const plainText = snippetToText(typeof job.snippet === "string" ? job.snippet : null);
  const remote = mentionsRemote(title) || mentionsRemote(location) || mentionsRemote(plainText);
  const inArea = location !== "" && matchesLocation(location, MUNICIPALITIES_ONLY);
  const remoteInColombia = remote && (location === "" || COLOMBIA_RE.test(clean(location)));
  if (!inArea && !remoteInColombia) return { skip: "fuera_de_cobertura" };

  const excerpt = makeExcerpt(plainText);
  const modalityText = truncate(`${title}. ${excerpt}`, 400);
  const modalityHint = normalizeModality(modalityText).value === "no_especificada" ? null : modalityText;

  return {
    posting: {
      provider: "jooble",
      id,
      title,
      company: str(job.company) ? decodeEntities(str(job.company)!) : null,
      location: location || "Colombia (remoto)",
      salary: str(job.salary),
      employmentType: str(job.type),
      url,
      excerpt,
      levelHint: makeLevelHint(title, plainText),
      modalityHint,
    },
  };
}

/** Solo copia textos: interpretar es trabajo de `normalize/`. */
export function joobleToDraft(posting: JooblePosting): OpportunityDraft {
  return {
    title: posting.title,
    organizationName: posting.company,
    typeText: posting.title,
    levelText: posting.levelHint,
    municipalityText: posting.location,
    modalityText: posting.modalityHint,
    compensationText: posting.salary,
    durationText: null,
    // Jooble no publica fecha de cierre.
    deadlineText: null,
    startDateText: null,
    description: posting.excerpt || null,
    programsText: null,
    semesterText: null,
    requirementsText: null,
    institutionsText: null,
    applyUrl: posting.url,
    sourceUrl: posting.url,
  };
}

function asJooblePosting(payload: unknown): JooblePosting {
  if (!isRecord(payload) || payload.provider !== "jooble" || typeof payload.title !== "string" || typeof payload.url !== "string") {
    throw new Error("Ítem de Jooble con formato inesperado");
  }
  return payload as unknown as JooblePosting;
}

// ---------------------------------------------------------------------------
// Adaptador
// ---------------------------------------------------------------------------

export interface JoobleAdapterOptions {
  transport: JoobleTransport;
  queries?: readonly JoobleQuery[];
  /** Tope de consultas de esta corrida (nunca más de `JOOBLE_DAILY_LIMIT`). */
  maxRequests?: number;
  pagesPerQuery?: number;
  resultsPerPage?: number;
  host?: string;
}

export interface JoobleRunStats {
  requests: number;
  received: number;
  repeated: number;
  notInternship: number;
  outOfArea: number;
  malformed: number;
  kept: number;
}

export function describeJoobleStats(stats: JoobleRunStats, maxRequests: number): string {
  return (
    `[${JOOBLE_SOURCE_ID}] ${stats.requests}/${maxRequests} consultas, ${stats.received} ofertas recibidas: ` +
    `${stats.kept} prácticas en el Valle de Aburrá o remotas, ${stats.notInternship} no son prácticas, ` +
    `${stats.outOfArea} fuera de cobertura, ${stats.repeated} repetidas entre búsquedas, ${stats.malformed} con formato inesperado`
  );
}

function parseBody(response: JoobleResponse): { totalCount: number; jobs: unknown[] } {
  let body: unknown;
  try {
    body = JSON.parse(response.text) as unknown;
  } catch {
    throw new Error("La respuesta de la API de Jooble no es JSON válido");
  }
  if (!isRecord(body) || !Array.isArray(body.jobs)) throw new Error("Jooble cambió el formato: no hay lista «jobs»");
  return { totalCount: typeof body.totalCount === "number" ? body.totalCount : body.jobs.length, jobs: list(body.jobs) };
}

export function createJoobleAdapter(options: JoobleAdapterOptions): SourceAdapter {
  const queries = options.queries ?? DEFAULT_JOOBLE_QUERIES;
  const maxRequests = Math.min(JOOBLE_DAILY_LIMIT, Math.max(1, options.maxRequests ?? DEFAULT_MAX_REQUESTS));
  const pagesPerQuery = Math.max(1, options.pagesPerQuery ?? DEFAULT_PAGES_PER_QUERY);
  const resultsPerPage = Math.max(1, options.resultsPerPage ?? DEFAULT_RESULTS_PER_PAGE);
  const host = options.host ?? JOOBLE_HOST;

  return {
    id: JOOBLE_SOURCE_ID,
    name: JOOBLE_SOURCE_NAME,
    method: "api",
    autoPublish: false,

    async fetch(ctx: AdapterContext): Promise<RawItem[]> {
      if (!(await ctx.http.isAllowed(`https://${host}/api/`))) {
        throw new Error(`robots.txt de ${host} no permite /api/`);
      }
      const fetchedAt = ctx.now.toISOString();
      const stats: JoobleRunStats = { requests: 0, received: 0, repeated: 0, notInternship: 0, outOfArea: 0, malformed: 0, kept: 0 };
      const seen = new Set<string>();
      const items: RawItem[] = [];

      run: for (const query of queries) {
        let receivedForQuery = 0;
        for (let page = 1; page <= pagesPerQuery; page += 1) {
          if (stats.requests >= maxRequests) {
            ctx.log.warn(`[${JOOBLE_SOURCE_ID}] se alcanzó el tope de ${maxRequests} consultas de esta corrida`);
            break run;
          }
          stats.requests += 1;
          const response = await options.transport.post({
            keywords: query.keywords,
            location: query.location,
            ...(query.radius ? { radius: query.radius } : {}),
            page: String(page),
            ResultOnPage: String(resultsPerPage),
          });
          if (response.status === 403) {
            throw new Error(`Jooble rechazó la clave (403). JOOBLE_API_KEY debe ser la clave de ${host}`);
          }
          if (response.status === 429) {
            ctx.log.warn(`[${JOOBLE_SOURCE_ID}] Jooble dice que se acabaron las consultas de hoy (429): se detiene la corrida`);
            break run;
          }
          if (response.status !== 200) {
            ctx.log.warn(`[${JOOBLE_SOURCE_ID}] «${query.keywords}» página ${page}: respuesta ${response.status}, se salta`);
            break;
          }
          const { totalCount, jobs } = parseBody(response);
          stats.received += jobs.length;
          receivedForQuery += jobs.length;
          for (const job of jobs) {
            const mapped = joobleJobToPosting(job);
            if ("skip" in mapped) {
              if (mapped.skip === "no_es_practica") stats.notInternship += 1;
              else if (mapped.skip === "fuera_de_cobertura") stats.outOfArea += 1;
              else stats.malformed += 1;
              continue;
            }
            const { posting } = mapped;
            if (seen.has(posting.id)) {
              stats.repeated += 1;
              continue;
            }
            seen.add(posting.id);
            stats.kept += 1;
            items.push({ sourceId: JOOBLE_SOURCE_ID, externalId: posting.id, url: posting.url, payload: posting, fetchedAt });
          }
          // Sin más páginas: vino vacía o ya se recibió todo lo que hay (Jooble puede ignorar ResultOnPage).
          if (jobs.length === 0 || receivedForQuery >= totalCount) break;
        }
      }
      ctx.log.info(describeJoobleStats(stats, maxRequests));
      return items;
    },

    parse(raw): OpportunityDraft {
      return joobleToDraft(asJooblePosting(raw.payload));
    },
  };
}

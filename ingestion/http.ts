/**
 * Descarga respetuosa (AGENTS.md §12): robots.txt, pausa por host, sin cookies ni credenciales, solo GET.
 * No hay forma de enviar un POST, iniciar sesión ni saltarse un bloqueo desde este módulo: es intencional.
 */

export const BOT_NAME = "PracticasColBot";
export const BOT_VERSION = "0.1";
const MAX_RETRY_AFTER_MS = 60_000;
const DEFAULT_RETRY_MS = 5_000;
const MAX_REDIRECTS = 5;

/** User-Agent genérico del proyecto. El contacto solo sale de `INGESTION_CONTACT_URL`. */
export function defaultUserAgent(env: Record<string, string | undefined> = process.env): string {
  const contact = env.INGESTION_CONTACT_URL?.trim();
  return contact ? `${BOT_NAME}/${BOT_VERSION} (+${contact})` : `${BOT_NAME}/${BOT_VERSION}`;
}

export interface HttpResponse {
  status: number;
  text: string;
  /** URL final (después de redirecciones). */
  url: string;
}

export interface PoliteFetcher {
  /** GET respetando robots.txt y la pausa por host. Lanza `RobotsDisallowedError` si no está permitido. */
  get(url: string): Promise<HttpResponse>;
  isAllowed(url: string): Promise<boolean>;
}

export interface PoliteFetcherOptions {
  userAgent?: string;
  /** Pausa mínima entre peticiones al mismo host. */
  minDelayMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class RobotsDisallowedError extends Error {
  constructor(public readonly url: string) {
    super(`robots.txt no permite descargar ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

interface RobotsRule {
  allow: boolean;
  pattern: string;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelayMs: number | null;
}

export interface RobotsPolicy {
  isAllowed(path: string): boolean;
  crawlDelayMs: number | null;
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/**
 * Parser simple de robots.txt: aplica el grupo del propio bot si existe; si no, el de `*`.
 * Entre las reglas que coinciden gana el patrón más largo; en empate gana `Allow`.
 */
export function parseRobots(content: string, userAgent: string): RobotsPolicy {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelayMs: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      if (value) current.rules.push({ allow: field === "allow", pattern: value });
    } else if (field === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) current.crawlDelayMs = seconds * 1000;
    }
  }

  const token = userAgent.split(/[/\s]/)[0].toLowerCase();
  const own = groups.filter((g) => g.agents.some((a) => a !== "" && a !== "*" && token.includes(a)));
  const selected = own.length > 0 ? own : groups.filter((g) => g.agents.includes("*"));
  const rules = selected.flatMap((g) => g.rules).map((r) => ({ ...r, re: patternToRegExp(r.pattern) }));
  const delays = selected.map((g) => g.crawlDelayMs).filter((d): d is number => d !== null);

  return {
    crawlDelayMs: delays.length > 0 ? Math.max(...delays) : null,
    isAllowed(path: string): boolean {
      let winner: RobotsRule | null = null;
      for (const rule of rules) {
        if (!rule.re.test(path)) continue;
        if (
          !winner ||
          rule.pattern.length > winner.pattern.length ||
          (rule.pattern.length === winner.pattern.length && rule.allow)
        ) {
          winner = rule;
        }
      }
      return winner ? winner.allow : true;
    },
  };
}

const ALLOW_ALL: RobotsPolicy = { isAllowed: () => true, crawlDelayMs: null };
const DENY_ALL: RobotsPolicy = { isAllowed: () => false, crawlDelayMs: null };

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

function parseRetryAfter(header: string | null, nowMs: number): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - nowMs);
}

function parseHttpUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Solo se permiten URLs http(s): ${url}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error("No se permiten URLs con credenciales");
  }
  return parsed;
}

export function createPoliteFetcher(options: PoliteFetcherOptions = {}): PoliteFetcher {
  const userAgent = options.userAgent ?? defaultUserAgent();
  const minDelayMs = options.minDelayMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  /** Última petición por host y cola para que nunca haya dos a la vez contra el mismo host. */
  const lastRequestAt = new Map<string, number>();
  const queues = new Map<string, Promise<unknown>>();
  const robotsCache = new Map<string, Promise<RobotsPolicy>>();
  const hostDelay = new Map<string, number>();

  async function rawGet(url: URL): Promise<Response & { bodyText: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.href, {
        method: "GET",
        headers: { "User-Agent": userAgent, Accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.5" },
        credentials: "omit",
        redirect: "manual",
        signal: controller.signal,
      });
      const bodyText = await response.text();
      return Object.assign(response, { bodyText });
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`Tiempo de espera agotado (${timeoutMs} ms): ${url.href}`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Una petición a la vez por host, con la pausa mínima entre ellas. */
  function throttled<T>(host: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(host) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const last = lastRequestAt.get(host);
        if (last !== undefined) {
          const wait = last + Math.max(minDelayMs, hostDelay.get(host) ?? 0) - now();
          if (wait > 0) await sleep(wait);
        }
        try {
          return await task();
        } finally {
          lastRequestAt.set(host, now());
        }
      });
    queues.set(host, run);
    return run;
  }

  async function getWithRetry(url: URL): Promise<Response & { bodyText: string }> {
    const first = await throttled(url.host, () => rawGet(url));
    if (first.status !== 429 && first.status !== 503) return first;
    const retryAfter = parseRetryAfter(first.headers.get("retry-after"), now()) ?? DEFAULT_RETRY_MS;
    await sleep(Math.min(MAX_RETRY_AFTER_MS, Math.max(retryAfter, minDelayMs)));
    return throttled(url.host, () => rawGet(url));
  }

  function robotsFor(url: URL): Promise<RobotsPolicy> {
    const cached = robotsCache.get(url.origin);
    if (cached) return cached;
    const loading = (async (): Promise<RobotsPolicy> => {
      try {
        let target = new URL("/robots.txt", url.origin);
        let response = await throttled(target.host, () => rawGet(target));
        // robots.txt puede redirigir (p. ej. http → https o a www).
        for (let hop = 0; hop < MAX_REDIRECTS && response.status >= 300 && response.status < 400; hop += 1) {
          const location = response.headers.get("location");
          if (!location) return DENY_ALL;
          target = parseHttpUrl(new URL(location, target).href);
          response = await throttled(target.host, () => rawGet(target));
        }
        if (response.status >= 200 && response.status < 300) {
          const policy = parseRobots(response.bodyText, userAgent);
          if (policy.crawlDelayMs !== null) {
            hostDelay.set(url.host, Math.min(MAX_RETRY_AFTER_MS, policy.crawlDelayMs));
          }
          return policy;
        }
        // Sin robots.txt (404/410 y demás 4xx) no hay restricciones; 401/403 y 5xx se tratan como "no pasar".
        if (response.status === 401 || response.status === 403) return DENY_ALL;
        if (response.status >= 400 && response.status < 500) return ALLOW_ALL;
        return DENY_ALL;
      } catch {
        // Fallo de red: postura conservadora.
        return DENY_ALL;
      }
    })();
    robotsCache.set(url.origin, loading);
    return loading;
  }

  async function isAllowedUrl(url: URL): Promise<boolean> {
    const policy = await robotsFor(url);
    return policy.isAllowed(`${url.pathname}${url.search}`);
  }

  return {
    async isAllowed(url: string): Promise<boolean> {
      return isAllowedUrl(parseHttpUrl(url));
    },

    async get(url: string): Promise<HttpResponse> {
      let target = parseHttpUrl(url);
      for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        if (!(await isAllowedUrl(target))) throw new RobotsDisallowedError(target.href);
        const response = await getWithRetry(target);
        const location = response.headers.get("location");
        if (response.status >= 300 && response.status < 400 && location) {
          // Cada salto vuelve a pasar por robots.txt y por la pausa del host de destino.
          target = parseHttpUrl(new URL(location, target).href);
          continue;
        }
        return { status: response.status, text: response.bodyText, url: target.href };
      }
      throw new Error(`Demasiadas redirecciones: ${url}`);
    },
  };
}

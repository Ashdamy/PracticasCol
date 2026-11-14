import { describe, expect, it } from "vitest";
import { createPoliteFetcher, defaultUserAgent, parseRobots, RobotsDisallowedError } from "./http";

type Handler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

/** Red falsa con reloj virtual: `sleep` adelanta el reloj en vez de esperar. */
function fakeNetwork(handler: Handler) {
  let clock = 1_000_000;
  const calls: { url: string; at: number; init: RequestInit | undefined }[] = [];
  const sleeps: number[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url: url.href, at: clock, init });
    return handler(url, init);
  }) as typeof fetch;
  return {
    calls,
    sleeps,
    pages: () => calls.filter((c) => !c.url.endsWith("/robots.txt")),
    options: {
      fetchImpl,
      now: () => clock,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
    },
  };
}

const robots = (body: string) => (url: URL) =>
  url.pathname === "/robots.txt" ? new Response(body) : new Response(`contenido de ${url.pathname}`);

describe("defaultUserAgent", () => {
  it("es genérico y solo agrega contacto si está configurado", () => {
    expect(defaultUserAgent({})).toBe("PracticasColBot/0.1");
    expect(defaultUserAgent({ INGESTION_CONTACT_URL: " https://example.com/bot " })).toBe(
      "PracticasColBot/0.1 (+https://example.com/bot)",
    );
  });
});

describe("parseRobots", () => {
  const UA = "PracticasColBot/0.1";

  it("aplica Disallow/Allow por prefijo y gana el más largo", () => {
    const policy = parseRobots(
      ["User-agent: *", "Disallow: /privado", "Allow: /privado/publico", "Disallow: /buscar"].join("\n"),
      UA,
    );
    expect(policy.isAllowed("/")).toBe(true);
    expect(policy.isAllowed("/ofertas/1")).toBe(true);
    expect(policy.isAllowed("/privado/datos")).toBe(false);
    expect(policy.isAllowed("/privado/publico/1")).toBe(true);
    expect(policy.isAllowed("/buscar?q=x")).toBe(false);
  });

  it("el grupo propio reemplaza al de *", () => {
    const policy = parseRobots(
      ["User-agent: *", "Disallow: /", "", "User-agent: practicascolbot", "Disallow: /admin"].join("\n"),
      UA,
    );
    expect(policy.isAllowed("/ofertas")).toBe(true);
    expect(policy.isAllowed("/admin/x")).toBe(false);
  });

  it("ignora grupos de otros bots, comentarios y Disallow vacío", () => {
    const policy = parseRobots(
      ["# comentario", "User-agent: otrobot", "Disallow: /", "", "User-agent: *", "Disallow:", "Crawl-delay: 5"].join("\r\n"),
      UA,
    );
    expect(policy.isAllowed("/cualquier/cosa")).toBe(true);
    expect(policy.crawlDelayMs).toBe(5000);
  });

  it("varios User-agent seguidos comparten reglas; soporta * y $", () => {
    const policy = parseRobots(
      ["User-agent: a", "User-agent: *", "Disallow: /*.pdf$", "Disallow: /tmp/*/x"].join("\n"),
      UA,
    );
    expect(policy.isAllowed("/docs/a.pdf")).toBe(false);
    expect(policy.isAllowed("/docs/a.pdf?x=1")).toBe(true);
    expect(policy.isAllowed("/tmp/1/x")).toBe(false);
  });

  it("Disallow: / bloquea todo", () => {
    expect(parseRobots("User-agent: *\nDisallow: /", UA).isAllowed("/ofertas")).toBe(false);
  });
});

describe("createPoliteFetcher", () => {
  it("lee robots.txt una sola vez por origen y respeta Disallow", async () => {
    const net = fakeNetwork(robots("User-agent: *\nDisallow: /privado"));
    const http = createPoliteFetcher(net.options);

    expect(await http.isAllowed("https://a.example.com/ofertas")).toBe(true);
    expect(await http.isAllowed("https://a.example.com/privado/1")).toBe(false);
    const page = await http.get("https://a.example.com/ofertas");
    expect(page).toEqual({ status: 200, text: "contenido de /ofertas", url: "https://a.example.com/ofertas" });
    await expect(http.get("https://a.example.com/privado/1")).rejects.toBeInstanceOf(RobotsDisallowedError);

    expect(net.calls.filter((c) => c.url.endsWith("/robots.txt"))).toHaveLength(1);
    expect(net.pages()).toHaveLength(1);
  });

  it("sin robots.txt (404) → permitido", async () => {
    const net = fakeNetwork((url) =>
      url.pathname === "/robots.txt" ? new Response("no existe", { status: 404 }) : new Response("ok"),
    );
    const http = createPoliteFetcher(net.options);
    expect(await http.isAllowed("https://a.example.com/x")).toBe(true);
    expect((await http.get("https://a.example.com/x")).text).toBe("ok");
  });

  it("robots.txt con fallo de red, 5xx o 403 → NO permitido", async () => {
    for (const failure of [
      () => {
        throw new TypeError("fetch failed");
      },
      () => new Response("error", { status: 500 }),
      () => new Response("prohibido", { status: 403 }),
    ]) {
      const net = fakeNetwork((url) => (url.pathname === "/robots.txt" ? failure() : new Response("ok")));
      const http = createPoliteFetcher(net.options);
      expect(await http.isAllowed("https://a.example.com/x")).toBe(false);
      await expect(http.get("https://a.example.com/x")).rejects.toBeInstanceOf(RobotsDisallowedError);
      expect(net.pages()).toHaveLength(0);
    }
  });

  it("espera minDelayMs entre peticiones al mismo host, pero no entre hosts distintos", async () => {
    const net = fakeNetwork(robots(""));
    const http = createPoliteFetcher({ ...net.options, minDelayMs: 2000 });

    await http.get("https://a.example.com/1");
    await http.get("https://a.example.com/2");
    await http.get("https://a.example.com/3");
    const sameHost = net.calls.filter((c) => c.url.startsWith("https://a.example.com"));
    expect(sameHost).toHaveLength(4); // robots + 3 páginas
    for (let i = 1; i < sameHost.length; i += 1) {
      expect(sameHost[i].at - sameHost[i - 1].at).toBeGreaterThanOrEqual(2000);
    }

    const before = net.sleeps.length;
    await http.isAllowed("https://b.example.com/1");
    expect(net.sleeps.length).toBe(before);
  });

  it("peticiones simultáneas al mismo host se encolan con la pausa", async () => {
    const net = fakeNetwork(robots(""));
    const http = createPoliteFetcher({ ...net.options, minDelayMs: 2000 });
    await Promise.all([1, 2, 3].map((n) => http.get(`https://a.example.com/${n}`)));
    const times = net.pages().map((c) => c.at);
    expect(times).toHaveLength(3);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(2000);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(2000);
  });

  it("respeta Crawl-delay si es mayor que la pausa mínima", async () => {
    const net = fakeNetwork(robots("User-agent: *\nCrawl-delay: 10"));
    const http = createPoliteFetcher({ ...net.options, minDelayMs: 2000 });
    await http.get("https://a.example.com/1");
    await http.get("https://a.example.com/2");
    const [first, second] = net.pages();
    expect(second.at - first.at).toBeGreaterThanOrEqual(10_000);
  });

  it("ante 429 espera Retry-After y reintenta una sola vez", async () => {
    let attempts = 0;
    const net = fakeNetwork((url) => {
      if (url.pathname === "/robots.txt") return new Response("");
      attempts += 1;
      return attempts === 1
        ? new Response("despacio", { status: 429, headers: { "Retry-After": "7" } })
        : new Response("ok");
    });
    const http = createPoliteFetcher({ ...net.options, minDelayMs: 2000 });
    const page = await http.get("https://a.example.com/x");
    expect(page).toMatchObject({ status: 200, text: "ok" });
    expect(attempts).toBe(2);
    expect(net.sleeps).toContain(7000);
  });

  it("Retry-After se limita a 60 s y un segundo 503 se devuelve tal cual", async () => {
    let attempts = 0;
    const net = fakeNetwork((url) => {
      if (url.pathname === "/robots.txt") return new Response("");
      attempts += 1;
      return new Response("caído", { status: 503, headers: { "Retry-After": "3600" } });
    });
    const http = createPoliteFetcher({ ...net.options, minDelayMs: 2000 });
    const page = await http.get("https://a.example.com/x");
    expect(page.status).toBe(503);
    expect(attempts).toBe(2);
    expect(Math.max(...net.sleeps)).toBe(60_000);
  });

  it("solo GET, con el User-Agent del bot y sin cookies ni credenciales", async () => {
    const net = fakeNetwork(robots(""));
    const http = createPoliteFetcher({ ...net.options, userAgent: "PracticasColBot/0.1" });
    await http.get("https://a.example.com/x");
    for (const call of net.calls) {
      const headers = new Headers(call.init?.headers);
      expect(call.init?.method).toBe("GET");
      expect(call.init?.credentials).toBe("omit");
      expect(call.init?.body).toBeUndefined();
      expect(headers.get("user-agent")).toBe("PracticasColBot/0.1");
      expect(headers.has("cookie")).toBe(false);
      expect(headers.has("authorization")).toBe(false);
    }
    await expect(http.get("https://usuario:clave@a.example.com/x")).rejects.toThrow("credenciales");
    await expect(http.get("ftp://a.example.com/x")).rejects.toThrow("http(s)");
  });

  it("las redirecciones vuelven a pasar por robots.txt del destino", async () => {
    const net = fakeNetwork((url) => {
      if (url.pathname === "/robots.txt") {
        return new Response(url.host === "b.example.com" ? "User-agent: *\nDisallow: /" : "");
      }
      if (url.pathname === "/a-b") return new Response(null, { status: 302, headers: { Location: "https://b.example.com/x" } });
      if (url.pathname === "/viejo") return new Response(null, { status: 301, headers: { Location: "/nuevo" } });
      return new Response(`contenido de ${url.pathname}`);
    });
    const http = createPoliteFetcher(net.options);
    expect(await http.get("https://a.example.com/viejo")).toEqual({
      status: 200,
      text: "contenido de /nuevo",
      url: "https://a.example.com/nuevo",
    });
    await expect(http.get("https://a.example.com/a-b")).rejects.toBeInstanceOf(RobotsDisallowedError);
    expect(net.calls.some((c) => c.url === "https://b.example.com/x")).toBe(false);
  });

  it("corta por tiempo de espera", async () => {
    const net = fakeNetwork((url, init) => {
      if (url.pathname === "/robots.txt") return new Response("", { status: 404 });
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    const http = createPoliteFetcher({ ...net.options, timeoutMs: 20 });
    await expect(http.get("https://a.example.com/lento")).rejects.toThrow("Tiempo de espera agotado");
  });
});

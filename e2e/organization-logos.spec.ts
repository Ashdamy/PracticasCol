import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  channel: "chrome",
  viewport: { width: 390, height: 844 },
});

let fixtureScript: string;
test.beforeAll(async () => {
  // esbuild is already supplied by the repository's tsx tooling.
  const result = await build({
    entryPoints: ["e2e/fixtures/organization-logos.tsx"],
    bundle: true,
    write: false,
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  fixtureScript = result.outputFiles[0].text;
});

async function openFixture(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const html = await (await page.request.get("/")).text();
  const styles = (html.match(/<link\b[^>]*>/g) ?? [])
    .filter(tag => tag.includes('rel="stylesheet"')).join("");
  await page.route("**/__logo-fixture", route => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body><div id="root"></div><script src="/__logo-fixture.js"></script></body></html>`,
  }));
  await page.route("**/__logo-fixture.js", route => route.fulfill({
    contentType: "text/javascript", body: fixtureScript,
  }));
  await page.route("https://logos.example.test/**", route => route.fulfill({
    status: route.request().url().endsWith("missing.svg") ? 404 : 200,
    contentType: "image/svg+xml",
    body: route.request().url().endsWith("missing.svg") ? "Not found" : '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><path fill="#204c3c" d="M0 0h180v60H0z"/><path fill="#d5f477" d="M20 20h140v20H20z"/></svg>',
  }));
  await page.goto("/__logo-fixture");
  await expect(page.getByRole("button", { name: "Logo con error" })).toBeVisible();
  expect(errors).toEqual([]);
}

test("logos: carga directa con Referer, fondo claro y tamaño estable en ambos temas", async ({ page }) => {
  const logoRequest = page.waitForRequest("https://logos.example.test/valid.svg");
  await openFixture(page);
  const request = await logoRequest;
  expect(request.headers().referer).toBe(new URL(page.url()).origin + "/");
  const images = page.locator(".organization-initials img");
  await expect(images).toHaveCount(2);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(image).toHaveAttribute("src", "https://logos.example.test/valid.svg");
    await expect(image).toHaveAttribute("alt", "");
    await expect(image).toHaveAttribute("loading", "lazy");
    await expect(image).toHaveAttribute("width", "46");
    await expect(image).toHaveAttribute("height", "46");
    expect(await image.getAttribute("referrerpolicy")).toBeNull();
    await expect(image).toHaveCSS("object-fit", "contain");
  }
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const logo of await page.locator(".organization-initials").all()) {
        await expect(logo).toHaveCSS("background-color", "rgb(255, 255, 255)");
        const box = await logo.boundingBox();
        expect(box?.width).toBe(box?.height);
        expect(box!.width).toBeGreaterThanOrEqual(35);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width !== 320) {
        await page.screenshot({ path: test.info().outputPath(`logos-${theme}-${width}.png`), fullPage: true });
      }
    }
  }
});

test("logos: error y null conservan iniciales; una URL nueva vuelve a cargar", async ({ page }) => {
  await openFixture(page);
  const logos = page.locator(".organization-initials");
  const before = await logos.first().boundingBox();
  await page.getByRole("button", { name: "Logo con error" }).click();
  for (const logo of await logos.all()) {
    await logo.scrollIntoViewIfNeeded();
    await expect(logo).toHaveText("TA");
    await expect(logo.locator("img")).toHaveCount(0);
    await expect(logo).toHaveAttribute("aria-hidden", "true");
  }
  expect((await logos.first().boundingBox())?.width).toBe(before?.width);
  expect((await logos.first().boundingBox())?.height).toBe(before?.height);
  await page.getByRole("button", { name: "Cambiar logo" }).click();
  for (const image of await page.locator(".organization-initials img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await expect(page.locator(".organization-initials img")).toHaveCount(2);
  await page.getByRole("button", { name: "Sin logo" }).click();
  await expect(logos).toHaveText(["TA", "TA"]);
  await expect(page.locator(".organization-initials img")).toHaveCount(0);
});

test("logos: catálogo y detalle conservan nombre e iniciales con mocks sin logo", async ({ page }) => {
  await page.goto("/practicas?q=textiles");
  const row = page.locator(".opportunity-row").first();
  await expect(row.locator(".organization-initials")).toHaveText("TA");
  await expect(row.locator(".organization")).toHaveText("Textiles Aburrá S.A.S.");
  await row.locator("h2 a").click();
  const lockup = page.locator(".detail .organization-lockup");
  await expect(lockup.locator(".organization-initials")).toHaveText("TA");
  await expect(lockup.locator(".organization")).toHaveText("Textiles Aburrá S.A.S.");
  await expect(lockup.locator("img")).toHaveCount(0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) {
      await page.screenshot({ path: test.info().outputPath("detail-mobile.png") });
    }
  }
});

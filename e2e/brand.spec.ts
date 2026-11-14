import { test, expect } from "@playwright/test";

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  channel: "chrome",
});

test("marca legible en ambos temas, enlaces de inicio y metadatos publicados", async ({ page, request }) => {
  await page.goto("/practicas");
  const header = page.locator("header");
  const footer = page.locator("footer");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const logo = await header.locator(".brand-logo").boundingBox();
    const toggle = await header.getByRole("button", { name: "Activar tema oscuro" }).boundingBox();
    expect(logo!.x + logo!.width).toBeLessThanOrEqual(toggle!.x);
  }
  for (const region of [header, footer]) {
    const home = region.getByRole("link", { name: "PrácticasCol, inicio" });
    await expect(home).toHaveAttribute("href", "/");
    await home.scrollIntoViewIfNeeded();
    const img = home.locator(".brand-logo-light");
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await header.getByRole("button", { name: "Activar tema oscuro" }).click();
  for (const region of [header, footer]) {
    await region.locator(".brand-logo").scrollIntoViewIfNeeded();
    await expect(region.locator(".brand-logo-light")).toBeHidden();
    await expect(region.locator(".brand-logo-dark")).toBeVisible();
    await expect.poll(() => region.locator(".brand-logo-dark").evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await footer.getByRole("link", { name: "PrácticasCol, inicio" }).click();
  await expect(page).toHaveURL(/\/$/);
  for (const path of ["/", "/practicas/practicante-ingenieria-industrial-textiles-aburra"]) {
    await page.goto(path);
    const og = page.locator('meta[property="og:image"]');
    await expect(og).toHaveAttribute("content", /opengraph-image\.png/);
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    for (const selector of ['link[rel="icon"][type="image/svg+xml"]', 'link[rel="apple-touch-icon"]', 'meta[property="og:image"]']) {
      const element = page.locator(selector);
      const url = await element.getAttribute(selector.startsWith("meta") ? "content" : "href");
      const response = await request.get(new URL(url!, page.url()).pathname);
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"]).toMatch(/^image\//);
    }
  }
});

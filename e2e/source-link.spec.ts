import { test, expect } from "@playwright/test";

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  channel: "chrome",
  viewport: { width: 390, height: 844 },
});

const slug = "practicante-ingenieria-industrial-textiles-aburra";
const sourceUrl = "https://example.com/bolsa-universidad/oferta/1021";

test("la publicación original abre aparte y conserva búsqueda, detalle y postulación", async ({ page, context }) => {
  await context.route(sourceUrl, route => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: "<h1>Publicación original de prueba</h1>",
  }));
  for (const path of ["/practicas?q=textiles", "/design-system"]) {
    await page.goto(path);
    const card = page.locator(".opportunity-card").filter({
      has: page.locator(`h2 a[href="/practicas/${slug}"]`),
    }).first();
    const source = card.getByRole("link", { name: /Ver publicación original\s*:.*pestaña nueva/ });
    await expect(source).toHaveAttribute("href", sourceUrl);
    await expect(source).toHaveAttribute("target", "_blank");
    await expect(source).toHaveAttribute("rel", "noopener noreferrer");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(source).toBeVisible();
      expect(await source.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const initialUrl = page.url();
    await source.focus();
    const popupPromise = page.waitForEvent("popup");
    await page.keyboard.press("Enter");
    const popup = await popupPromise;
    await expect(popup).toHaveURL(sourceUrl);
    await expect(popup.getByRole("heading")).toHaveText("Publicación original de prueba");
    expect(await popup.evaluate(() => window.opener === null)).toBe(true);
    await popup.close();
    await expect(page).toHaveURL(initialUrl);
    await card.locator("h2 a").click();
    await expect(page).toHaveURL(`/practicas/${slug}`);
    await expect(page.getByRole("link", { name: /Ver publicación original\s*:/ })).toHaveAttribute("href", sourceUrl);
    await expect(page.getByRole("link", { name: /Ir a la convocatoria oficial/ })).toHaveAttribute("href", `https://example.com/postular/${slug}`);
  }
});

test("descripción sin doble punto e imagen social con el origen configurado", async ({ page }) => {
  for (const path of [`/practicas/${slug}`, "/practicas/pasantia-programacion-software-silleta"]) {
    await page.goto(path);
    const organization = (await page.locator(".detail .organization").innerText()).trimEnd();
    const description = await page.locator('meta[property="og:description"]').getAttribute("content");
    const prefix = organization.endsWith(".") ? organization : `${organization}.`;
    expect(description?.startsWith(`${prefix} `)).toBe(true);
    expect(description).not.toContain("S.A.S..");
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(new URL(image!).origin).toBe(new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").origin);
  }
});

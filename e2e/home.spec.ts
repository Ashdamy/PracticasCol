import { test, expect } from "@playwright/test";

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  viewport: { width: 390, height: 844 },
  channel: "chrome",
});

test("portada: búsqueda, accesos por nivel e imagen responsive", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Prácticas para lo que viene." });
  await expect(hero).toBeVisible();
  await expect(hero.getByRole("img")).toBeVisible();
  await expect.poll(() => hero.getByRole("img").evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  for (const width of [320, 390, 768, 820, 1024, 1440, 1912]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const searchButton = await hero.getByRole("button", { name: "Buscar prácticas" }).boundingBox();
    expect(searchButton?.height).toBeGreaterThanOrEqual(44);
    expect(searchButton!.y + searchButton!.height).toBeLessThan(900);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Activar tema oscuro" }).click();
  await expect(hero).toHaveCSS("background-color", "rgb(213, 244, 119)");
  await hero.getByLabel("Programa, cargo o empresa").fill("software");
  await hero.getByRole("button", { name: "Buscar prácticas" }).click();
  await expect(page).toHaveURL(/practicas\?q=software/);
  await page.goto("/");
  await page.getByRole("link", { name: "Soy tecnólogo o aprendiz SENA", exact: true }).click();
  await expect(page).toHaveURL(/nivel=tecnologo/);
  await expect(page.getByRole("link", { name: /Quitar filtro Tecnólogo/ })).toBeVisible();
});

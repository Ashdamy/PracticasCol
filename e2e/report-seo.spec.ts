import { test, expect } from "@playwright/test";

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  channel: "chrome",
  viewport: { width: 390, height: 844 },
});

const detail = "/practicas/practicante-ingenieria-industrial-textiles-aburra";

test("reporte accesible: teclado, límite, aviso y éxito real sin datos personales", async ({ page }) => {
  await page.goto(detail);
  const trigger = page.getByRole("button", { name: "Reportar un problema" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Reportar un problema" });
  const reason = dialog.getByRole("combobox", { name: "Motivo" });
  const comment = dialog.getByRole("textbox", { name: "Comentario (opcional)" });
  await expect(reason).toBeFocused();
  await expect(dialog.locator("input")).toHaveCount(0);
  await expect(reason.locator("option")).toHaveCount(6);
  await dialog.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(reason).toBeFocused();
  await reason.selectOption("sospechosa");
  await expect(dialog.getByText(/Una práctica nunca debe cobrar/)).toBeVisible();
  await comment.fill("x".repeat(510));
  await expect(comment).toHaveValue("x".repeat(500));
  await expect(dialog.getByText("500/500 caracteres")).toBeVisible();
  await comment.fill("El anuncio pide un pago para participar.");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.getByRole("button", { name: "Enviar reporte" }).scrollIntoViewIfNeeded();
    if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/report-${width}.png` });
  }
  const close = dialog.getByRole("button", { name: "Cerrar reporte", exact: true });
  const submit = dialog.getByRole("button", { name: "Enviar reporte" });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(submit).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(comment).toHaveValue("El anuncio pide un pago para participar.");
  await submit.click();
  const thanks = dialog.getByRole("heading", { name: "Gracias, lo revisaremos" });
  await expect(thanks).toBeVisible();
  await expect(thanks).toBeFocused();
  await expect(submit).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(trigger).toBeFocused();
});

test("en curso: sin doble envío incluso al cerrar y reabrir", async ({ page }) => {
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/practicas/**", async route => {
    if (!route.request().headers()["next-action"]) return route.continue();
    requests++;
    await gate;
    await route.continue();
  });
  await page.goto(detail);
  const trigger = page.getByRole("button", { name: "Reportar un problema" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Motivo", { exact: true }).selectOption("enlace_roto");
  await dialog.locator("form").evaluate(form => {
    (form as HTMLFormElement).requestSubmit();
    (form as HTMLFormElement).requestSubmit();
  });
  await expect(dialog.getByRole("button", { name: "Enviando…", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await trigger.click();
  await expect(dialog.getByRole("button", { name: "Enviando…", exact: true })).toBeDisabled();
  await expect.poll(() => requests).toBe(1);
  release();
  await expect(dialog.getByRole("heading", { name: "Gracias, lo revisaremos" })).toBeVisible();
  expect(requests).toBe(1);
});

test("errores de campo del servidor, error general y recuperación conservan el comentario", async ({ page }) => {
  let mode: "fields" | "missing" | "network" | "success" = "fields";
  await page.route("**/practicas/**", async route => {
    if (!route.request().headers()["next-action"]) return route.continue();
    if (mode === "network") return route.abort("failed");
    if (mode === "success") return route.continue();
    // Modifica solo la petición de prueba; la respuesta sigue siendo el ActionResult real.
    const args = route.request().postDataJSON();
    if (mode === "fields") {
      args[0].reason = "motivo_invalido";
      args[0].comment = "x".repeat(501);
    } else args[0].opportunityId = "no-existe";
    await route.continue({ postData: JSON.stringify(args) });
  });
  await page.goto(detail);
  await page.getByRole("button", { name: "Reportar un problema" }).click();
  const dialog = page.getByRole("dialog");
  const reason = dialog.getByLabel("Motivo", { exact: true });
  const comment = dialog.getByLabel("Comentario (opcional)");
  const submit = dialog.getByRole("button", { name: "Enviar reporte" });
  await reason.selectOption("datos_incorrectos");
  await comment.fill("La modalidad publicada no coincide.");
  await submit.click();
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(comment).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.locator(".field-error")).toHaveCount(2);
  await expect(reason).toBeFocused();
  await expect(comment).toHaveValue("La modalidad publicada no coincide.");
  mode = "missing";
  await submit.click();
  await expect(dialog.getByRole("alert")).toHaveText("La convocatoria no existe.");
  await expect(dialog.getByRole("alert")).toBeFocused();
  mode = "network";
  await submit.click();
  await expect(dialog.getByRole("alert")).toContainText("Revisa tu conexión");
  await expect(comment).toHaveValue("La modalidad publicada no coincide.");
  mode = "success";
  await submit.click();
  await expect(dialog.getByRole("heading", { name: "Gracias, lo revisaremos" })).toBeVisible();
});

test("una convocatoria vencida también permite reportar sin comentario", async ({ page }) => {
  await page.goto("/practicas/practica-comunicacion-servicios-publicos-valle");
  await page.getByRole("button", { name: "Activar tema oscuro" }).click();
  await page.getByRole("button", { name: "Reportar un problema" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Motivo", { exact: true }).selectOption("vencida");
  await page.screenshot({ path: "test-results/report-dark.png" });
  await dialog.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(dialog.getByRole("heading", { name: "Gracias, lo revisaremos" })).toBeVisible();
});

test("SEO: robots, sitemap estático y galería según el modo del servidor", async ({ page, request }) => {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Allow: /");
  expect(await robots.text()).toContain("Disallow: /design-system");
  expect(await robots.text()).toContain("Disallow: /admin");
  expect(await robots.text()).toContain(`Sitemap: ${new URL("/sitemap.xml", base).href}`);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  expect(urls).toEqual(["/", "/practicas", "/fuentes", "/perfil"].map(path => new URL(path, base).href));
  const response = await page.goto("/design-system");
  if (process.env.PLAYWRIGHT_SERVER_MODE === "development") {
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Sistema de diseño", exact: true })).toBeVisible();
  } else {
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Sistema de diseño", exact: true })).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  }
});

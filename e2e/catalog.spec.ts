import { test, expect } from "@playwright/test";

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  viewport: { width: 390, height: 844 },
  channel: "chrome",
});

test("accesos rápidos y cambio de tema mantienen la búsqueda", async ({
  page,
}) => {
  await page.goto("/practicas?q=software");
  await page.getByRole("link", { name: "Pasantías", exact: true }).click();
  await expect(page).toHaveURL(/tipo=pasantia/);
  await expect(page).toHaveURL(/q=software/);
  await page.getByRole("button", { name: "Activar tema oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Activar tema claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("filtros móviles, URL, chips y cierre accesible", async ({ page }) => {
  await page.goto("/practicas");
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Remota", { exact: false }).check();
  await dialog.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/modalidad=remota/);
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: /Filtros/ }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: "Quitar filtro Remota" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Quitar filtro Remota" }).click();
  await expect(page).not.toHaveURL(/modalidad=/);
});

test("búsqueda vacía, paginación y detalle con fuente oficial", async ({
  page,
}) => {
  await page.goto("/practicas?q=zzzzsinresultados");
  await expect(
    page.getByRole("heading", {
      name: "No encontramos prácticas con estos filtros",
    }),
  ).toBeVisible();
  await page.goto("/practicas?por_pagina=2");
  await page.getByRole("link", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/pagina=2/);
  await page.locator(".opportunity-card h2 a").first().click();
  await expect(
    page.getByRole("heading", { name: "Requisitos de la convocatoria" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Ir a la convocatoria oficial/ }),
  ).toHaveAttribute("target", "_blank");
  await expect(page.locator(".eligibility-panel .disclaimer")).toBeVisible();
});

test("perfil académico, veredicto y eliminación de cookie", async ({
  page,
  context,
}) => {
  await page.goto("/perfil");
  await page
    .getByRole("combobox", { name: "Institución", exact: true })
    .selectOption("inst-eafit");
  await page
    .getByRole("combobox", { name: "Programa académico", exact: true })
    .selectOption("prog-ing-industrial");
  await page.getByLabel("Semestre o trimestre (opcional)").fill("8");
  await page
    .getByRole("button", { name: "Guardar perfil y ver prácticas" })
    .click();
  await expect(page).toHaveURL(/\/practicas$/);
  expect((await context.cookies()).some((c) => c.name === "pc_profile")).toBe(
    true,
  );
  await page.locator(".opportunity-card h2 a").first().click();
  await expect(page.locator(".checks li").first()).toBeVisible();
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Borrar mi perfil" }).click();
  await expect(page).toHaveURL(/\/practicas$/);
  expect(
    (await context.cookies()).some((c) => c.name === "pc_profile" && c.value),
  ).toBe(false);
});

test("vencida, retirada y sin desbordamiento en móvil", async ({ page }) => {
  await page.goto("/practicas/practica-comunicacion-servicios-publicos-valle");
  await expect(
    page.getByText("Esta convocatoria ya cerró.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Ir a la convocatoria oficial/ }),
  ).toHaveCount(0);
  await page.goto("/practicas/no-existe");
  await expect(
    page.getByRole("heading", { name: "No encontramos esta convocatoria" }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/practicas?por_pagina=2");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

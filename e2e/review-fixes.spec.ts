import { test, expect } from "@playwright/test";

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  viewport: { width: 390, height: 844 },
  channel: "chrome",
});

test("el tema se conserva al recargar y el control refleja el tema actual", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/practicas");
  await page.getByRole("button", { name: "Activar tema oscuro" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Activar tema claro" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "Activar tema oscuro" }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(
    page.getByRole("button", { name: "Activar tema claro" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("el tema sigue funcionando sin acceso a localStorage", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto("/practicas");
  await page.getByRole("button", { name: "Activar tema oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Activar tema claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("metadatos propios, semestre mínimo y chip de cierre hoy", async ({
  page,
  request,
}) => {
  const path = "/practicas/practicante-ingenieria-industrial-textiles-aburra";
  await page.goto(path);
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  await expect(page).toHaveTitle(
    `${title} en Textiles Aburrá S.A.S. | PrácticasCol`,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    `${title} en Textiles Aburrá S.A.S. | PrácticasCol`,
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    /Textiles Aburrá/,
  );
  await expect(
    page.getByText("Desde 8.º semestre", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('meta[name="page-type"], meta[name="site-kind"]'),
  ).toHaveCount(0);
  expect(await page.locator("html").getAttribute("data-type")).toBeNull();

  const botResponse = await request.get(path, {
    headers: { "user-agent": "facebookexternalhit/1.1" },
  });
  const head = (await botResponse.text()).split("</head>")[0];
  expect(head).toContain('property="og:title"');
  expect(head).toContain("Textiles Aburrá");

  await page.goto("/practicas?cierra_en=0");
  await expect(
    page.getByRole("link", { name: "Quitar filtro Cierra hoy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Quitar filtro Cierra hoy", exact: true })
    .click();
  await expect(page).not.toHaveURL(/cierra_en=/);
});

test("perfil con programa ausente en institución se guarda y puede editarse", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/perfil");
  const institution = page.getByRole("combobox", {
    name: "Institución",
    exact: true,
  });
  const program = page.getByRole("combobox", {
    name: "Programa académico",
    exact: true,
  });
  await institution.selectOption("inst-eafit");
  await expect(program.locator('option[value="prog-enfermeria"]')).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", {
      name: "Mi programa no aparece → ver todos los programas",
    })
    .click();
  await expect(program).toBeFocused();
  await program.selectOption("prog-enfermeria");
  await expect(institution).toHaveValue("inst-eafit");
  await page
    .getByRole("button", { name: "Guardar perfil y ver prácticas" })
    .click();
  await expect(page).toHaveURL(/\/practicas$/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".profile-nudge")).toHaveCount(0);
  await page.goto("/perfil");
  await expect(institution).toHaveValue("inst-eafit");
  await expect(program).toHaveValue("prog-enfermeria");
  await expect(
    page.getByRole("button", { name: "Ver programas de mi institución" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver programas de mi institución" })
    .click();
  await expect(program).toHaveValue("");
  await page.getByRole("button", { name: "Borrar mi perfil" }).click();
  await expect(page).toHaveURL(/\/practicas$/);
  await expect(page.locator(".profile-nudge")).toBeVisible();
});

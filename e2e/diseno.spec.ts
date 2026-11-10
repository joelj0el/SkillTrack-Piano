import { expect, test } from "@playwright/test";

test("PU-diseno-01: la galería funciona, cambia de tema y respeta la política de seguridad", async ({
  page,
}) => {
  const violaciones: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) {
      violaciones.push(m.text());
    }
  });

  await page.goto("/design");
  await expect(page.getByRole("heading", { level: 1, name: "Sistema de diseño" })).toBeVisible();

  await page.getByRole("button", { name: "Cambiar a tema oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro");

  await page.getByRole("button", { name: "Abrir diálogo" }).click();
  await expect(page.getByRole("dialog", { name: "Ejemplo de diálogo" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Mostrar aviso" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();

  await page.goto("/design/vista/conteo");
  await expect(page.locator("[data-pulso]")).toBeVisible();
  expect(violaciones).toEqual([]);
});

test("PU-diseno-02: Cancelar durante la ejecución mide al menos 56 px", async ({ page }) => {
  await page.goto("/design/vista/ejecucion");
  const caja = await page.getByRole("button", { name: "Cancelar" }).boundingBox();
  expect(caja?.height).toBeGreaterThanOrEqual(56);
});
